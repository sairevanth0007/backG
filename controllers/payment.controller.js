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


// Helper function to add duration to a date (already in passport-setup, but good to have here too)
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
 * @route POST /api/v1/payment/create-checkout-session
 * @description Creates a Stripe Checkout Session for a new subscription or to extend an existing one.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @body {string} planId - The MongoDB _id of the plan the user wants to subscribe to or extend.
 * @security BasicAuth
 * @returns {ApiResponse.model} 200 - Contains the Stripe Checkout Session URL.
 * @returns {ApiError.model} 400 - Bad request if plan not found or invalid.
 * @returns {ApiError.model} 500 - Internal server error.
 */
const createCheckoutSession = asyncHandler(async (req, res, next) => {
    const { planId, quantity = 1 } = req.body;
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
        // The user.save() for stripeCustomerId is now correctly done below after session creation
        // if it was just generated.
    }

    const successUrl = `${bridge.FRONTEND_URL}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${bridge.FRONTEND_URL}/dashboard?payment=canceled`;

    let sessionMode;
    let lineItems = [];
    let metadata = {
        userId: userId.toString(),
        planId: plan._id.toString(),
        planType: plan.type, // Make sure plan.type is always in metadata
    };
    let subscriptionData = {};

    const isExtendingSamePlan = (
        user.subscriptionStatus === 'active' &&
        user.currentPlanId &&
        user.currentPlanId.equals(plan._id) &&
        (plan.type === PlanTypes.MONTHLY || plan.type === PlanTypes.YEARLY)
    );

    if (isExtendingSamePlan) {
        sessionMode = 'payment';
        lineItems.push({
            price: plan.stripePriceId,
            quantity: 1,
        });
        metadata.paymentPurpose = 'extension';
        metadata.originalSubscriptionId = user.stripeSubscriptionId;
        console.log(`User ${user.email} is extending their existing ${plan.type} plan.`);

    } else {
        sessionMode = 'subscription';
        lineItems.push({
            price: plan.stripePriceId,
            quantity: 1,
        });
        subscriptionData = {
            metadata: {
                userId: userId.toString(),
            },
        };
        metadata.paymentPurpose = 'new_subscription';
        console.log(`User ${user.email} is purchasing a NEW ${plan.type} subscription.`);
    }

    try {
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            line_items: lineItems,
            mode: sessionMode,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: metadata,
            subscription_data: sessionMode === 'subscription' ? subscriptionData : undefined,
            allow_promotion_codes: true,
        });

        if (!user.stripeCustomerId) {
             user.stripeCustomerId = stripeCustomerId;
             await user.save({ validateBeforeSave: false });
        }

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
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @returns {void} Sends a 200 OK response to Stripe.
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

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutSessionCompleted(event.data.object);
            break;

        case 'invoice.payment_succeeded':
            await handleInvoicePaymentSucceeded(event.data.object);
            break;

        case 'customer.subscription.updated':
            await handleSubscriptionUpdated(event.data.object);
            break;

        case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(event.data.object);
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.status(HttpStatusCode.OK).send('Webhook Received');
});

/**
 * Handle checkout.session.completed
 */
async function handleCheckoutSessionCompleted(session) {
    console.log(`✅ Checkout Session Completed: ${session.id}`);

    const userId = session.metadata.userId;
    const planId = session.metadata.planId;
    const paymentPurpose = session.metadata.paymentPurpose;
    const purchasedPlanType = session.metadata.planType;

    const user = await User.findById(userId);
    const plan = await Plan.findById(planId);

    if (!user || !plan) {
        console.error(`User or Plan not found. UserID: ${userId}, PlanID: ${planId}`);
        return;
    }

    // Handle team subscription
    if (paymentPurpose === 'team_subscription') {
        const seats = parseInt(session.metadata.seats);
        
        if (!session.subscription) {
            console.warn(`Team checkout session ${session.id} has no subscription attached.`);
            return;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        
        // Create team subscription record
        const teamSub = new TeamSubscription({
            ownerId: user._id,
            planId: plan._id,
            stripeSubscriptionId: subscription.id,
            stripePriceId: plan.stripePriceId,
            totalSeats: seats,
            usedSeats: 1, // Owner counts as 1 seat
            subscriptionStatus: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        await teamSub.save();

        // Update user
        user.stripeCustomerId = session.customer.toString();
        user.isTeamOwner = true;
        user.ownedTeamSubscription = teamSub._id;
        await user.save({ validateBeforeSave: false });

        console.log(`Team subscription created for ${user.email} with ${seats} seats.`);
        return;
    }

    // Handle extension payment
    if (paymentPurpose === 'extension') {
        let extensionDurationMonths = 1;
        if (purchasedPlanType === PlanTypes.YEARLY) {
            extensionDurationMonths = 12;
        }

        let newExpiry;
        if (!user.subscriptionExpiresAt || user.subscriptionExpiresAt < new Date()) {
            newExpiry = addMonths(new Date(), extensionDurationMonths);
        } else {
            newExpiry = addMonths(new Date(user.subscriptionExpiresAt), extensionDurationMonths);
        }
        
        user.subscriptionExpiresAt = newExpiry;
        user.subscriptionStatus = 'active';
        await user.save({ validateBeforeSave: false });
        
        console.log(`User ${user.email} subscription extended by ${extensionDurationMonths} months.`);
        return;
    }

    // Handle new personal subscription
    if (paymentPurpose === 'new_subscription') {
        if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            
            user.stripeSubscriptionId = subscription.id;
            user.stripeCustomerId = session.customer.toString();
            user.currentPlanId = plan._id;
            user.currentPlanType = plan.type;
            user.subscriptionStatus = subscription.status;
            user.subscriptionExpiresAt = new Date(subscription.current_period_end * 1000);
            await user.save({ validateBeforeSave: false });
            
            console.log(`User ${user.email} new subscription: ${plan.name}`);
        }
    }
}

/**
 * Handle invoice.payment_succeeded
 */
async function handleInvoicePaymentSucceeded(invoice) {
    console.log(`💰 Invoice Payment Succeeded: ${invoice.id}`);
    
    if (!invoice.subscription) {
        console.log('Invoice has no subscription attached.');
        return;
    }

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    // Check if it's a team subscription
    const teamSub = await TeamSubscription.findOne({ stripeSubscriptionId: subscription.id });
    
    if (teamSub) {
        // Handle team subscription renewal
        const newPeriodEnd = new Date(subscription.current_period_end * 1000);
        
        teamSub.subscriptionStatus = subscription.status;
        teamSub.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        teamSub.currentPeriodEnd = newPeriodEnd;
        teamSub.cancelAtPeriodEnd = subscription.cancel_at_period_end;
        
        // Clean up pending_removal members
        await TeamMember.updateMany(
            {
                teamSubscriptionId: teamSub._id,
                status: 'pending_removal',
                accessExpiresAt: { $lt: newPeriodEnd }
            },
            {
                status: 'removed'
            }
        );
        
        // Recalculate used seats (count active members + 1 for owner)
        const activeMembers = await TeamMember.countDocuments({
            teamSubscriptionId: teamSub._id,
            status: 'active'
        });
        teamSub.usedSeats = activeMembers + 1; // +1 for owner
        
        await teamSub.save();
        
        // Update extended expiry for team members
        const members = await TeamMember.find({
            teamSubscriptionId: teamSub._id,
            status: 'active'
        });
        
        for (const member of members) {
            const memberUser = await User.findById(member.userId);
            if (memberUser && memberUser.extendedExpiryFromPersonalPlan) {
                // Check if extended expiry is within this period
                if (memberUser.extendedExpiryFromPersonalPlan <= newPeriodEnd) {
                    memberUser.extendedExpiryFromPersonalPlan = null;
                    await memberUser.save({ validateBeforeSave: false });
                }
            }
        }
        
        console.log(`Team subscription ${teamSub._id} renewed. Period end: ${newPeriodEnd}`);
        return;
    }
    
    // Handle personal subscription renewal
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });
    if (user) {
        const stripeCurrentPeriodEnd = new Date(subscription.current_period_end * 1000);
        
        if (!user.subscriptionExpiresAt || stripeCurrentPeriodEnd > user.subscriptionExpiresAt) {
            user.subscriptionExpiresAt = stripeCurrentPeriodEnd;
        }
        
        user.subscriptionStatus = subscription.status;
        await user.save({ validateBeforeSave: false });
        
        console.log(`User ${user.email} subscription renewed via invoice payment.`);
    }
}

/**
 * Handle customer.subscription.updated
 */
async function handleSubscriptionUpdated(updatedSubscription) {
    console.log(`🔄 Subscription Updated: ${updatedSubscription.id}`);
    
    // Check if it's a team subscription
    const teamSub = await TeamSubscription.findOne({ 
        stripeSubscriptionId: updatedSubscription.id 
    });
    
    if (teamSub) {
        teamSub.subscriptionStatus = updatedSubscription.status;
        teamSub.currentPeriodStart = new Date(updatedSubscription.current_period_start * 1000);
        teamSub.currentPeriodEnd = new Date(updatedSubscription.current_period_end * 1000);
        teamSub.cancelAtPeriodEnd = updatedSubscription.cancel_at_period_end;
        
        // Check if quantity changed
        if (updatedSubscription.items.data.length > 0) {
            const newQuantity = updatedSubscription.items.data[0].quantity;
            if (newQuantity !== teamSub.totalSeats) {
                console.log(`Team seats updated from ${teamSub.totalSeats} to ${newQuantity}`);
                teamSub.totalSeats = newQuantity;
            }
        }
        
        await teamSub.save();
        console.log(`Team subscription ${teamSub._id} updated.`);
        return;
    }
    
    // Handle personal subscription update
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
        console.log(`User ${userUpdated.email} subscription updated.`);
    }
}

/**
 * Handle customer.subscription.deleted
 */
async function handleSubscriptionDeleted(deletedSubscription) {
    console.log(`🗑️ Subscription Deleted: ${deletedSubscription.id}`);
    
    // Check if it's a team subscription
    const teamSub = await TeamSubscription.findOne({ 
        stripeSubscriptionId: deletedSubscription.id 
    });
    
    if (teamSub) {
        const periodEnd = deletedSubscription.current_period_end 
            ? new Date(deletedSubscription.current_period_end * 1000) 
            : new Date();
        
        teamSub.subscriptionStatus = 'canceled';
        teamSub.cancelAtPeriodEnd = true;
        
        // Members retain access until period end
        await TeamMember.updateMany(
            {
                teamSubscriptionId: teamSub._id,
                status: 'active'
            },
            {
                accessExpiresAt: periodEnd
            }
        );
        
        await teamSub.save();
        
        console.log(`Team subscription ${teamSub._id} canceled. Access until: ${periodEnd}`);
        return;
    }
    
    // Handle personal subscription deletion
    const userDeleted = await User.findOne({ stripeSubscriptionId: deletedSubscription.id });
    if (userDeleted) {
        userDeleted.stripeSubscriptionId = null;
        userDeleted.currentPlanId = null;
        userDeleted.currentPlanType = null;
        userDeleted.subscriptionStatus = 'canceled';
        
        const stripePeriodEnd = deletedSubscription.current_period_end 
            ? new Date(deletedSubscription.current_period_end * 1000) 
            : new Date();
        
        if (!userDeleted.subscriptionExpiresAt || userDeleted.subscriptionExpiresAt < stripePeriodEnd) {
            userDeleted.subscriptionExpiresAt = stripePeriodEnd;
        }
        
        await userDeleted.save({ validateBeforeSave: false });
        console.log(`User ${userDeleted.email} subscription canceled. Access until: ${stripePeriodEnd}`);
    }
}




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