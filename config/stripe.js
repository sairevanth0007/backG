/**
 * @file config/stripe.js
 * @description Stripe API initialization and constants for plan price IDs.
 * @author GIDE
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
    console.error("❌ STRIPE_SECRET_KEY is not set in environment variables. Stripe operations will fail.");
}
if (!stripePublishableKey) {
    console.error("❌ STRIPE_PUBLISHABLE_KEY is not set in environment variables.");
}
if (!stripeWebhookSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET is not set in environment variables. Webhook signature verification will fail.");
}

/**
 * @constant {Stripe} stripe
 * @description Stripe API client instance.
 */
export const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-04-10', // Use a stable API version
});

/**
 * @constant {object} STRIPE_PLAN_PRICE_IDS
 * @description Stores the Stripe Price IDs for monthly and yearly plans.
 * These IDs must be created in your Stripe Dashboard.
 */
export const STRIPE_PLAN_PRICE_IDS = {
    MONTHLY: process.env.STRIPE_MONTHLY_PLAN_PRICE_ID,
    YEARLY: process.env.STRIPE_YEARLY_PLAN_PRICE_ID,
};

/**
 * @constant {string} STRIPE_WEBHOOK_SECRET
 * @description Webhook signing secret for verifying Stripe webhook events.
 */
export { stripeWebhookSecret };