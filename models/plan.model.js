/**
 * @file models/plan.model.js
 * @description Defines the Mongoose schema for Plans.
 * @author GIDE
 */

import mongoose, { Schema } from 'mongoose';
import { PlanTypes } from '../constants/index.js';

/**
 * @typedef {object} Plan
 * @property {string} name - The name of the plan (e.g., "Monthly Pro", "Yearly Business").
 * @property {string} type - The type of the plan (e.g., 'Monthly', 'Yearly'). Must be one of PlanTypes.
 * @property {number} price - The price of the plan in the smallest currency unit (e.g., cents for USD). 1000 for $10.00.
 * @property {string} currency - The currency of the price (e.g., 'usd', 'eur'). Defaults to 'usd'.
 * @property {string} stripePriceId - The ID of the corresponding price object in Stripe. This is crucial for Stripe integration.
 * @property {string[]} [features] - An array of strings describing the features of the plan.
 * @property {string} [description] - A brief description of the plan.
 * @property {boolean} isActive - Whether the plan is currently active and available for new subscriptions. Defaults to true.
 * @property {Date} createdAt - Timestamp of when the plan was created.
 * @property {Date} updatedAt - Timestamp of when the plan was last updated.
 */
const planSchema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Plan name is required.'],
            trim: true,
            unique: true,
        },
        type: {
            type: String,
            enum: {
                values: Object.values(PlanTypes).filter(pt => pt !== PlanTypes.FREE_TRIAL), // Exclude FreeTrial as a purchasable plan type
                message: 'Invalid plan type. Must be Monthly or Yearly.',
            },
            required: [true, 'Plan type is required (Monthly/Yearly).'],
        },
        price: { // Price in smallest currency unit (e.g., cents)
            type: Number,
            required: [true, 'Plan price is required.'],
            min: [0, 'Price cannot be negative.'],
        },
        currency: {
            type: String,
            default: 'usd',
            lowercase: true,
            trim: true,
        },
        stripePriceId: {
            type: String,
            required: [true, 'Stripe Price ID is required for the plan.'],
            unique: true,
            trim: true,
        },
        features: {
            type: [String],
            default: [],
        },
        description: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

export const Plan = mongoose.model('Plan', planSchema);