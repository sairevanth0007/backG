/**
 * @file models/user.model.js
 * @description Defines the Mongoose schema for Users.
 * @author GIDE
 */

import mongoose, { Schema } from 'mongoose';
import jwt from 'jsonwebtoken';
// import bcrypt from 'bcryptjs'; // Not directly used for OAuth-only, but good to have if local auth is added
import { OAuthProviders, PlanTypes } from '../constants/index.js';

/**
 * @typedef {object} User
 * @property {string} email - User's email address (unique).
 * @property {string} name - User's full name.
 * @property {string} [avatar] - URL to the user's avatar image.
 * @property {string} provider - The OAuth provider used for login (e.g., 'google', 'github', 'microsoft').
 * @property {string} providerId - The unique ID of the user from the OAuth provider.
 * @property {mongoose.Schema.Types.ObjectId} [referredBy] - The User ID of the person who referred this user.
 * @property {mongoose.Schema.Types.ObjectId} [referralDetails] - Reference to this user's own referral record in the Referral collection.
 * @property {string} [stripeCustomerId] - Stripe customer ID for this user.
 * @property {string} [stripeSubscriptionId] - Stripe subscription ID for the current active subscription.
 * @property {string} [subscriptionStatus] - Status of the user's subscription (e.g., 'active', 'trialing', 'past_due', 'canceled', 'inactive').
 * @property {mongoose.Schema.Types.ObjectId} [currentPlanId] - Reference to the Plan collection for the user's current active plan.
 * @property {string} [currentPlanType] - Type of the current plan ('Monthly', 'Yearly', 'FreeTrial'). Useful for quick checks.
 * @property {Date} [subscriptionExpiresAt] - Date when the current subscription or trial period expires.
 * @property {boolean} [isFreeTrialEligible] - Flag indicating if the user is still eligible for a free trial. Defaults to true.
 * @property {boolean} [hasUsedFreeTrial] - Flag indicating if the user has already used their free trial. Defaults to false.
 * @property {Date} [lastLoginAt] - Timestamp of the user's last login.
 * @property {string} [refreshToken] - JWT refresh token (if implementing JWT for session management alongside OAuth).
 * @property {Date} createdAt - Timestamp of when the user was created.
 * @property {Date} updatedAt - Timestamp of when the user was last updated.
 */
const userSchema = new Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required.'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
        },
        name: {
            type: String,
            required: [true, 'Name is required.'],
            trim: true,
        },
        avatar: {
            type: String, // URL
            trim: true,
        },
        provider: {
            type: String,
            required: [true, 'OAuth provider is required.'],
            enum: {
                values: Object.values(OAuthProviders),
                message: 'Invalid OAuth provider.',
            },
        },
        providerId: {
            type: String,
            required: [true, 'OAuth provider ID is required.'],
        },
        // Referral System
        referredBy: { // User ID of the one who referred this user
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        isTeamOwner: {
        type: Boolean,
        default: false,
    },
    ownedTeamSubscription: {
        type: Schema.Types.ObjectId,
        ref: 'TeamSubscription',
        default: null,
    },
    
    // Team Member Fields
    isTeamMember: {
        type: Boolean,
        default: false,
    },
    teamMembership: {
        type: Schema.Types.ObjectId,
        ref: 'TeamMember',
        default: null,
    },
    
    // Extended expiry from personal plan when joining team
    extendedExpiryFromPersonalPlan: {
        type: Date,
        default: null,
    },
    
    // Track if user's personal subscription was canceled due to team join
    personalPlanCanceledForTeam: {
        type: Boolean,
        default: false,
    },
        referralDetails: { // Link to this user's own referral code document
            type: Schema.Types.ObjectId,
            ref: 'Referral',
            default: null,
        },
        // Stripe and Subscription Details
        stripeCustomerId: {
            type: String,
            trim: true,
        },
        stripeSubscriptionId: {
            type: String,
            trim: true,
        },
        subscriptionStatus: {
            type: String,
            trim: true,
            enum: [
                null, // No active subscription or status not set
                PlanTypes.FREE_TRIAL, // Specifically for free trial status
                'active',        // Paid subscription is active
                'trialing',      // Stripe trial period (if used directly from Stripe)
                'past_due',      // Payment failed
                'canceled',      // Subscription was canceled by user or admin
                'unpaid',        // Stripe status for unpaid
                'incomplete',    // Stripe status for incomplete payment
                'incomplete_expired', // Stripe status
                'ended'          // Subscription has ended naturally and not renewed
            ],
            default: null,
        },
        currentPlanId: { // ID of the plan from Plan collection
            type: Schema.Types.ObjectId,
            ref: 'Plan',
            default: null,
        },
        currentPlanType: { // For easier querying ('Monthly', 'Yearly', 'FreeTrial')
            type: String,
            enum: [...Object.values(PlanTypes), null], // null if no plan
            default: null,
        },
        subscriptionExpiresAt: {
            type: Date,
            default: null,
        },
        isFreeTrialEligible: { // Can the user activate a free trial?
            type: Boolean,
            default: true,
        },
        hasUsedFreeTrial: { // Has the user consumed their free trial?
            type: Boolean,
            default: false,
        },
        lastLoginAt: {
            type: Date,
        },
        refreshToken: { // For JWT based auth persistence if needed beyond OAuth session
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
        // Create a compound index for provider and providerId for faster lookups
        // and to ensure a user is unique per provider.
        indexes: [{ fields: { provider: 1, providerId: 1 }, unique: true }],
    }
);

// --- JWT Token Generation Methods (Optional - useful if you want your own API tokens post-OAuth) ---

/**
 * @method generateAccessToken
 * @memberof User
 * @instance
 * @description Generates a JWT access token for the user.
 * @returns {string} JWT access token.
 */
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name,
            provider: this.provider,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        }
    );
};

/**
 * @method generateRefreshToken
 * @memberof User
 * @instance
 * @description Generates a JWT refresh token for the user.
 * @returns {string} JWT refresh token.
 */
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
        }
    );
};

userSchema.methods.hasActiveAccess = async function() {
    const now = new Date();
    
    // Check personal subscription
    if (this.subscriptionStatus === 'active' && this.subscriptionExpiresAt > now) {
        return true;
    }
    
    // Check team membership
    if (this.isTeamMember && this.teamMembership) {
        const TeamMember = mongoose.model('TeamMember');
        const membership = await TeamMember.findById(this.teamMembership)
            .populate('teamSubscriptionId');
        
        if (membership && 
            membership.status === 'active' && 
            membership.teamSubscriptionId.subscriptionStatus === 'active' &&
            membership.teamSubscriptionId.currentPeriodEnd > now) {
            return true;
        }
    }
    
    // Check extended expiry from personal plan
    if (this.extendedExpiryFromPersonalPlan && this.extendedExpiryFromPersonalPlan > now) {
        return true;
    }
    
    // Check team ownership
    if (this.isTeamOwner && this.ownedTeamSubscription) {
        const TeamSubscription = mongoose.model('TeamSubscription');
        const teamSub = await TeamSubscription.findById(this.ownedTeamSubscription);
        
        if (teamSub && 
            teamSub.subscriptionStatus === 'active' && 
            teamSub.currentPeriodEnd > now) {
            return true;
        }
    }
    
    return false;
};

/**
 * ADD THIS METHOD TO YOUR USER MODEL
 * Get user's effective subscription details (personal or team)
 */
userSchema.methods.getEffectiveSubscription = async function() {
    const now = new Date();
    
    // Priority 1: Team Owner
    if (this.isTeamOwner && this.ownedTeamSubscription) {
        const TeamSubscription = mongoose.model('TeamSubscription');
        const teamSub = await TeamSubscription.findById(this.ownedTeamSubscription)
            .populate('planId');
        
        if (teamSub && teamSub.subscriptionStatus === 'active' && teamSub.currentPeriodEnd > now) {
            return {
                type: 'team_owner',
                subscription: teamSub,
                expiresAt: teamSub.currentPeriodEnd,
                planName: teamSub.planId.name,
                seats: `${teamSub.usedSeats}/${teamSub.totalSeats}`,
            };
        }
    }
    
    // Priority 2: Personal Subscription
    if (this.subscriptionStatus === 'active' && this.subscriptionExpiresAt > now) {
        return {
            type: 'personal',
            subscription: {
                planId: this.currentPlanId,
                status: this.subscriptionStatus,
            },
            expiresAt: this.subscriptionExpiresAt,
            planName: this.currentPlanType,
        };
    }
    
    // Priority 3: Team Member
    if (this.isTeamMember && this.teamMembership) {
        const TeamMember = mongoose.model('TeamMember');
        const membership = await TeamMember.findById(this.teamMembership)
            .populate({
                path: 'teamSubscriptionId',
                populate: { path: 'planId ownerId' }
            });
        
        if (membership && 
            membership.status === 'active' && 
            membership.teamSubscriptionId.subscriptionStatus === 'active' &&
            membership.teamSubscriptionId.currentPeriodEnd > now) {
            return {
                type: 'team_member',
                subscription: membership.teamSubscriptionId,
                expiresAt: this.extendedExpiryFromPersonalPlan || membership.teamSubscriptionId.currentPeriodEnd,
                planName: membership.teamSubscriptionId.planId.name,
                ownerEmail: membership.teamSubscriptionId.ownerId.email,
            };
        }
    }
    
    return null;
};


export const User = mongoose.model('User', userSchema);