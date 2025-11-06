/**
 * @file routes/payment.routes.js
 * @description Payment-related API routes for Stripe integration.
 * @author GIDE
 */

import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller.js';
import { isAuthenticated } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validator.middleware.js';
import { validatePlanIdSchema } from '../validators/payment.validator.js';

const router = Router();

/**
 * @swagger
 * /payment/webhook:
 *   post:
 *     summary: Stripe webhook endpoint.
 *     description: Receives asynchronous events from Stripe to update subscription status in the database. This endpoint requires raw JSON body for signature verification and must be publicly accessible by Stripe.
 *     tags:
 *       - Payment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: The raw JSON payload from Stripe.
 *     responses:
 *       200:
 *         description: Webhook received and processed successfully.
 *       400:
 *         description: Bad request due to invalid signature or malformed event.
 */
router.post('/webhook', paymentController.handleStripeWebhook); // Note: raw body parsing for this route is handled in app.js

/**
 * @swagger
 * /payment/create-checkout-session:
 *   post:
 *     summary: Creates a Stripe Checkout Session for new subscription or to extend existing one.
 *     description: Initiates the process for a user to subscribe to a plan (if new) or extend their current plan (if already active on the same plan type). It generates a Stripe Checkout Session URL, to which the user is redirected to complete payment.
 *     tags:
 *       - Payment
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlanIdPayload'
 *     responses:
 *       200:
 *         description: Stripe Checkout Session created successfully. Returns the session ID and URL.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               statusCode: 200
 *               data:
 *                 sessionId: "cs_test_12345"
 *                 url: "https://checkout.stripe.com/c/pay/cs_test_12345"
 *               message: "Stripe Checkout Session created successfully."
 *               success: true
 *       400:
 *         description: Bad request (e.g., missing planId, invalid planId, inactive plan).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Unauthorized if user is not logged in.
 *       500:
 *         description: Internal server error during session creation.
 */
router.post('/create-checkout-session', isAuthenticated, validate(validatePlanIdSchema), paymentController.createCheckoutSession);

/**
 * @swagger
 * /payment/upgrade-to-yearly:
 *   post:
 *     summary: Upgrades an existing Monthly subscription to a Yearly plan.
 *     description: Changes the user's current active Monthly Stripe subscription to the equivalent Yearly plan. Proration is handled by Stripe.
 *     tags:
 *       - Payment
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Subscription successfully upgraded to Yearly Plan.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               statusCode: 200
 *               data:
 *                 subscriptionId: "sub_123abc"
 *                 newPriceId: "price_yearly_pro"
 *               message: "Subscription successfully upgraded to Yearly Plan."
 *               success: true
 *       400:
 *         description: Bad request (e.g., user not on active Monthly plan, no active subscription).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Unauthorized if user is not logged in.
 *       404:
 *         description: Yearly plan not found in database.
 *       500:
 *         description: Internal server error during upgrade process.
 */
router.post('/upgrade-to-yearly', isAuthenticated, paymentController.upgradeToYearly);


/**
 * @swagger
 * /payment/manage-subscription:
 *   post:
 *     summary: Creates a Stripe Customer Portal session.
 *     description: Redirects the user to the Stripe Customer Portal, where they can manage their billing information, view invoices, and cancel their subscription.
 *     tags:
 *       - Payment
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Stripe Customer Portal session created successfully. Returns the portal URL.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               statusCode: 200
 *               data:
 *                 portalUrl: "https://billing.stripe.com/p/portal/acct_123/session_123"
 *               message: "Stripe Customer Portal session created successfully."
 *               success: true
 *       400:
 *         description: Bad request (e.g., user has no Stripe Customer ID).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *       401:
 *         description: Unauthorized if user is not logged in.
 *       500:
 *         description: Internal server error during portal session creation.
 */
router.post('/manage-subscription', isAuthenticated, paymentController.manageSubscriptionPortal);
// ... (existing imports) ...

/**
 * @swagger
 * /payment/plans:
 *   get:
 *     summary: Retrieves all active subscription plans.
 *     description: Fetches a list of available monthly and yearly subscription plans from the database.
 *     tags:
 *       - Payment
 *     responses:
 *       200:
 *         description: A list of active plans.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               statusCode: 200
 *               data:
 *                 - _id: "60c72b2f9f1b2c001c8e4d6a"
 *                   name: "Basic Monthly"
 *                   type: "Monthly"
 *                   price: 1000
 *                   currency: "usd"
 *                   stripePriceId: "price_monthly_example"
 *                   features: ["Access to basic features", "Email support"]
 *                   description: "Our most affordable monthly plan."
 *                   isActive: true
 *                 - _id: "60c72b2f9f1b2c001c8e4d6b"
 *                   name: "Premium Yearly"
 *                   type: "Yearly"
 *                   price: 10000
 *                   currency: "usd"
 *                   stripePriceId: "price_yearly_example"
 *                   features: ["Access to all features", "Priority support"]
 *                   description: "Save money with our yearly plan."
 *                   isActive: true
 *               message: "Resource fetched successfully."
 *               success: true
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/plans', paymentController.getPlans); // <-- ADD THIS LINE


export default router;