/**
 * @file controllers/payment.controller.js
 * @description Controller for Stripe payment operations and webhook handling.
 * @author GIDE
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { HttpStatusCode, AppMessages, PlanTypes } from '../constants/index.js';
import { stripe, STRIPE_PLAN_PRICE_IDS, stripeWebhookSecret } from '../config/stripe.js';
import { User } from '../models/user.model.js';
import { Plan } from '../models/plan.model.js';
import { bridge } from '../bridge.js';

// Helper function to add duration to a date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * @async
 * @function createCheckoutSession
 * @description Creates a Stripe Checkout Session for a new subscription.
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 * @param {Express.NextFunction} next - Express next middleware function.
 */
const createCheckoutSession = asyncHandler(async (req, res, next) => {
    const { planId } = req.body;
    const userId = req.user._id;

    if (!planId) {
        throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Plan ID is required to create a checkout session.');
    }

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
        throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Selected plan not found or is inactive.');
    }

    let user = req.user;
    let stripeCustomerId = user.stripeCustomerId;

    if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name,
            metadata: {
                userId: userId.toString(),
            },
        });
        stripeCustomerId = customer.id;
        user.stripeCustomerId = stripeCustomerId;
        await user.save({ validateBeforeSave: false });
    }

    const successUrl = `${bridge.FRONTEND_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${bridge.FRONTEND_URL}/dashboard?payment=canceled`;

    try {
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            line_items: [
                {
                    price: plan.stripePriceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                userId: userId.toString(),
                planId: plan._id.toString(),
                planType: plan.type,
            },
            subscription_data: {
                metadata: {
                    userId: userId.toString(),
                },
            },
            allow_promotion_codes: true,
        });

        return res.status(HttpStatusCode.OK).json(new ApiResponse(
            HttpStatusCode.OK,
            { sessionId: session.id, url: session.url },
            'Stripe Checkout Session created successfully.'
        ));

    } catch (error) {
        console.error("Error creating Stripe Checkout Session:", error);
        throw new ApiError(
            HttpStatusCode.INTERNAL_SERVER_ERROR,
            error.message || 'Failed to create Stripe Checkout Session.'
        );
    }
});

/**
 * @async
 * @function handleStripeWebhook
 * @description Handles incoming Stripe webhook events.
 * This endpoint is public and should not have authentication middleware.
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err) {
        console.error(`❌ Webhook Error: ${err.message}`);
        return res.status(HttpStatusCode.BAD_REQUEST).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log(`✅ Checkout Session Completed: ${session.id}`);

            if (session.subscription) {
                const subscription = await stripe.subscriptions.retrieve(session.subscription);
                const userId = session.metadata.userId;
                const planId = session.metadata.planId;
                const planType = session.metadata.planType;

                const user = await User.findById(userId);
                const plan = await Plan.findById(planId);

                if (user && plan) {
                    user.stripeSubscriptionId = subscription.id;
                    user.stripeCustomerId = session.customer.toString();
                    user.currentPlanId = plan._id;
                    user.currentPlanType = plan.type;
                    user.subscriptionStatus = subscription.status;
                    user.subscriptionExpiresAt = new Date(subscription.current_period_end * 1000);
                    
                    await user.save({ validateBeforeSave: false });
                    console.log(`User ${user.email} subscription updated to ${plan.name}.`);
                } else {
                    console.error(`User or Plan not found for checkout.session.completed. UserID: ${userId}, PlanID: ${planId}`);
                }
            } else {
                console.warn(`Checkout session ${session.id} completed but no subscription attached.`);
            }
            break;

        case 'invoice.payment_succeeded':
            const invoice = event.data.object;
            console.log(`💰 Invoice Payment Succeeded: ${invoice.id}`);
            if (invoice.subscription) {
                const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                const user = await User.findOne({ stripeSubscriptionId: subscription.id });

                if (user) {
                    user.subscriptionStatus = subscription.status;
                    user.subscriptionExpiresAt = new Date(subscription.current_period_end * 1000);
                    await user.save({ validateBeforeSave: false });
                    console.log(`User ${user.email} subscription extended via invoice payment.`);
                } else {
                    console.warn(`User not found for subscription ID ${subscription.id} during invoice.payment_succeeded.`);
                }
            }
            break;

        case 'customer.subscription.updated':
            const updatedSubscription = event.data.object;
            console.log(`🔄 Subscription Updated: ${updatedSubscription.id}`);
            const userUpdated = await User.findOne({ stripeSubscriptionId: updatedSubscription.id });
            if (userUpdated) {
                userUpdated.subscriptionStatus = updatedSubscription.status;
                userUpdated.subscriptionExpiresAt = new Date(updatedSubscription.current_period_end * 1000);

                if (updatedSubscription.items.data.length > 0) {
                    const newPriceId = updatedSubscription.items.data[0].price.id;
                    const newPlan = await Plan.findOne({ stripePriceId: newPriceId });
                    if (newPlan) {
                        userUpdated.currentPlanId = newPlan._id;
                        userUpdated.currentPlanType = newPlan.type;
                    }
                }
                await userUpdated.save({ validateBeforeSave: false });
                console.log(`User ${userUpdated.email} subscription details updated (status: ${userUpdated.subscriptionStatus}, expires: ${userUpdated.subscriptionExpiresAt}).`);
            }
            break;

        case 'customer.subscription.deleted':
            const deletedSubscription = event.data.object;
            console.log(`🗑️ Subscription Deleted: ${deletedSubscription.id}`);
            const userDeleted = await User.findOne({ stripeSubscriptionId: deletedSubscription.id });
            if (userDeleted) {
                userDeleted.stripeSubscriptionId = null;
                userDeleted.currentPlanId = null;
                userDeleted.currentPlanType = null;
                userDeleted.subscriptionStatus = 'canceled';
                userDeleted.subscriptionExpiresAt = deletedSubscription.current_period_end ? new Date(deletedSubscription.current_period_end * 1000) : new Date();
                await userDeleted.save({ validateBeforeSave: false });
                console.log(`User ${userDeleted.email} subscription marked as canceled.`);
            }
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(HttpStatusCode.OK).send('Webhook Received');
});


/**
 * @async
 * @function upgradeToYearly
 * @description Allows a user to upgrade their existing Monthly subscription to a Yearly subscription.
 * This updates the existing Stripe subscription.
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 */
const upgradeToYearly = asyncHandler(async (req, res) => {
    const user = req.user;

    if (!user.stripeSubscriptionId || user.subscriptionStatus !== 'active' || user.currentPlanType !== PlanTypes.MONTHLY) {
        throw new ApiError(
            HttpStatusCode.BAD_REQUEST,
            'You must have an active Monthly plan to upgrade to Yearly.'
        );
    }

    const yearlyPlan = await Plan.findOne({ type: PlanTypes.YEARLY, isActive: true });
    if (!yearlyPlan) {
        throw new ApiError(HttpStatusCode.NOT_FOUND, 'Yearly plan not found in database.');
    }
    if (!yearlyPlan.stripePriceId) {
        console.error(`Yearly plan (${yearlyPlan.name}) missing Stripe Price ID.`);
        throw new ApiError(HttpStatusCode.INTERNAL_SERVER_ERROR, 'Yearly plan misconfigured.');
    }

    try {
        const currentSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        const subscriptionItem = currentSubscription.items.data.find(item => item.price.id === user.currentPlanId.stripePriceId);
        if (!subscriptionItem) {
            throw new ApiError(HttpStatusCode.INTERNAL_SERVER_ERROR, 'Could not find current subscription item.');
        }

        const updatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
            items: [
                {
                    id: subscriptionItem.id,
                    price: yearlyPlan.stripePriceId,
                },
            ],
        });

        return res.status(HttpStatusCode.OK).json(new ApiResponse(
            HttpStatusCode.OK,
            { subscriptionId: updatedSubscription.id, newPriceId: yearlyPlan.stripePriceId },
            'Subscription successfully upgraded to Yearly Plan.'
        ));

    } catch (error) {
        console.error("Error upgrading subscription:", error);
        throw new ApiError(
            HttpStatusCode.INTERNAL_SERVER_ERROR,
            error.message || 'Failed to upgrade subscription.'
        );
    }
});


/**
 * @async
 * @function manageSubscriptionPortal
 * @description Creates a Stripe Customer Portal session for users to manage their subscription.
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 */
const manageSubscriptionPortal = asyncHandler(async (req, res) => {
    const user = req.user;

    if (!user.stripeCustomerId) {
        throw new ApiError(
            HttpStatusCode.BAD_REQUEST,
            'You do not have an active Stripe customer ID to manage subscriptions.'
        );
    }

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `${bridge.FRONTEND_URL}/dashboard?portal=return`,
        });

        return res.status(HttpStatusCode.OK).json(new ApiResponse(
            HttpStatusCode.OK,
            { portalUrl: session.url },
            'Stripe Customer Portal session created successfully.'
        ));
    } catch (error) {
        console.error("Error creating Stripe Customer Portal session:", error);
        throw new ApiError(
            HttpStatusCode.INTERNAL_SERVER_ERROR,
            error.message || 'Failed to create Stripe Customer Portal session.'
        );
    }
});


/**
 * @async
 * @function getPlans
 * @route GET /api/v1/payment/plans
 * @description Retrieves a list of active subscription plans from the database.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {ApiResponse.model} 200 - List of active plans.
 * @returns {ApiError.model} 500 - Internal server error.
 */
const getPlans = asyncHandler(async (req, res) => {
    // Find all active plans and select specific fields to return
    const plans = await Plan.find({ isActive: true }).select('-createdAt -updatedAt -__v');
    return res.status(HttpStatusCode.OK).json(new ApiResponse(
        HttpStatusCode.OK,
        plans,
        AppMessages.FETCHED
    ));
});



export const paymentController = {
    createCheckoutSession,
    handleStripeWebhook,
    upgradeToYearly,
    manageSubscriptionPortal,
    getPlans,
};