/**
 * @file seeders/seedPlans.js
 * @description Script to seed initial plan data into the MongoDB database.
 * @author GIDE
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Plan } from '../models/plan.model.js';
import { PlanTypes, DB_NAME } from '../constants/index.js';

dotenv.config(); // Adjust path to .env file

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * IMPORTANT: Replace these with your actual Stripe Price IDs created in your Stripe Dashboard.
 * These are essential for Stripe Checkout to work correctly.
 */
const MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PLAN_PRICE_ID || 'price_replace_with_your_monthly_id';
const YEARLY_PRICE_ID = process.env.STRIPE_YEARLY_PLAN_PRICE_ID || 'price_replace_with_your_yearly_id';

const plansToSeed = [
    {
        name: 'Basic Monthly',
        type: PlanTypes.MONTHLY,
        price: 1000, // $10.00 in cents
        currency: 'usd',
        stripePriceId: MONTHLY_PRICE_ID,
        features: ['Access to basic features', 'Email support'],
        description: 'Our most affordable monthly plan for essential features.',
        isActive: true,
    },
    {
        name: 'Premium Yearly',
        type: PlanTypes.YEARLY,
        price: 10000, // $100.00 in cents
        currency: 'usd',
        stripePriceId: YEARLY_PRICE_ID,
        features: ['Access to all features', 'Priority email support', 'Exclusive content'],
        description: 'Save money with our yearly plan, granting full access.',
        isActive: true,
    },
];

const seedPlans = async () => {
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI is not defined in the environment variables. Cannot connect to database.');
        process.exit(1);
    }
    if (MONTHLY_PRICE_ID === 'price_replace_with_your_monthly_id' || YEARLY_PRICE_ID === 'price_replace_with_your_yearly_id') {
         console.warn('⚠️  Stripe Price IDs are placeholder values. Please update .env and seeders/seedPlans.js with your actual Stripe Price IDs before running in production!');
    }

    try {
        await mongoose.connect(`${MONGODB_URI}/${DB_NAME}`);
        console.log('☘️  MongoDB connection established for seeding.');

        console.log('Clearing existing plans...');
        await Plan.deleteMany({}); // Clears all existing plans to avoid duplicates on re-run
        console.log('Existing plans cleared.');

        console.log('Seeding new plans...');
        await Plan.insertMany(plansToSeed);
        console.log(`✅ Successfully seeded ${plansToSeed.length} plans.`);

    } catch (error) {
        console.error('❌ Error during plan seeding:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Connection to MongoDB closed.');
    }
};

seedPlans();