/**
 * @file models/teamMember.model.js
 * @description Defines the Mongoose schema for Team Members.
 */

import mongoose, { Schema } from 'mongoose';

/**
 * @typedef {object} TeamMember
 * @property {mongoose.Schema.Types.ObjectId} teamSubscriptionId - Reference to TeamSubscription
 * @property {mongoose.Schema.Types.ObjectId} userId - Reference to the User who is a team member
 * @property {string} memberEmail - Email of the team member
 * @property {string} status - Status: 'active', 'removed', 'pending_removal'
 * @property {Date} addedAt - When member was added to team
 * @property {Date} removedAt - When member was removed (if applicable)
 * @property {Date} accessExpiresAt - When access expires (if removed but still has access till period end)
 * @property {Object} transitionDetails - Details about personal plan transition
 * @property {mongoose.Schema.Types.ObjectId} transitionDetails.previousPlanId
 * @property {string} transitionDetails.previousStripeSubscriptionId
 * @property {number} transitionDetails.daysAddedToTeamEnd - Days from personal plan added to team end
 * @property {Date} transitionDetails.personalPlanCanceledAt
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */
const teamMemberSchema = new Schema(
    {
        teamSubscriptionId: {
            type: Schema.Types.ObjectId,
            ref: 'TeamSubscription',
            required: [true, 'Team subscription reference is required.'],
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User reference is required.'],
            index: true,
        },
        memberEmail: {
            type: String,
            required: [true, 'Member email is required.'],
            lowercase: true,
            trim: true,
        },
        status: {
            type: String,
            enum: ['active', 'removed', 'pending_removal'],
            default: 'active',
        },
        addedAt: {
            type: Date,
            default: Date.now,
        },
        removedAt: {
            type: Date,
        },
        accessExpiresAt: {
            type: Date,
        },
        // Track personal plan transition details
        transitionDetails: {
            previousPlanId: {
                type: Schema.Types.ObjectId,
                ref: 'Plan',
            },
            previousStripeSubscriptionId: {
                type: String,
            },
            daysAddedToTeamEnd: {
                type: Number,
                default: 0,
            },
            personalPlanCanceledAt: {
                type: Date,
            },
        },
    },
    { timestamps: true }
);

// Compound index to prevent duplicate active memberships
teamMemberSchema.index(
    { teamSubscriptionId: 1, userId: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'active' } }
);

// Index for efficient member queries
teamMemberSchema.index({ userId: 1, status: 1 });

export const TeamMember = mongoose.model('TeamMember', teamMemberSchema);