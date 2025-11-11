/**
 * @file models/teamSubscription.model.js
 * @description Defines the Mongoose schema for Team Subscriptions (Small Business plans).
 */

import mongoose, { Schema } from 'mongoose';
import { PlanTypes } from '../constants/index.js';

/**
 * @typedef {object} TeamSubscription
 * @property {mongoose.Schema.Types.ObjectId} ownerId - User who owns/pays for the team subscription
 * @property {mongoose.Schema.Types.ObjectId} planId - Reference to the Plan (Small Business plan)
 * @property {string} stripeSubscriptionId - Stripe subscription ID for this team
 * @property {string} stripePriceId - Stripe price ID used for this subscription
 * @property {number} totalSeats - Total number of seats purchased
 * @property {number} usedSeats - Number of seats currently occupied
 * @property {string} subscriptionStatus - Current status of the subscription
 * @property {Date} currentPeriodStart - Start of current billing period
 * @property {Date} currentPeriodEnd - End of current billing period
 * @property {boolean} cancelAtPeriodEnd - Whether subscription will cancel at period end
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */
const teamSubscriptionSchema = new Schema(
    {
        ownerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Team subscription must have an owner.'],
            index: true,
        },
        planId: {
            type: Schema.Types.ObjectId,
            ref: 'Plan',
            required: [true, 'Team subscription must reference a plan.'],
        },
        stripeSubscriptionId: {
            type: String,
            required: [true, 'Stripe subscription ID is required.'],
            unique: true,
            trim: true,
        },
        stripePriceId: {
            type: String,
            required: [true, 'Stripe price ID is required.'],
            trim: true,
        },
        totalSeats: {
            type: Number,
            required: [true, 'Total seats must be specified.'],
            min: [1, 'Minimum 1 seat required.'],
            max: [20, 'Maximum 20 seats allowed.'],
        },
        usedSeats: {
            type: Number,
            default: 0,
            min: [0, 'Used seats cannot be negative.'],
        },
        subscriptionStatus: {
            type: String,
            enum: [
                'active',
                'trialing',
                'past_due',
                'canceled',
                'unpaid',
                'incomplete',
                'incomplete_expired',
                'ended'
            ],
            default: 'active',
        },
        currentPeriodStart: {
            type: Date,
            required: true,
        },
        currentPeriodEnd: {
            type: Date,
            required: true,
        },
        cancelAtPeriodEnd: {
            type: Boolean,
            default: false,
        },
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual for available seats
teamSubscriptionSchema.virtual('availableSeats').get(function() {
    return this.totalSeats - this.usedSeats;
});

// Index for efficient queries
teamSubscriptionSchema.index({ ownerId: 1, subscriptionStatus: 1 });

export const TeamSubscription = mongoose.model('TeamSubscription', teamSubscriptionSchema);