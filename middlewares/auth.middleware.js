/**
 * ADD THIS MIDDLEWARE TO YOUR middlewares/auth.middleware.js
 * This checks if user has any active access (personal, team owner, or team member)
 */

import { ApiError } from '../utils/ApiError.js';
import { HttpStatusCode,AppMessages } from '../constants/index.js';
import { TeamSubscription } from '../models/teamSubscription.model.js';
import { TeamMember } from '../models/teamMember.model.js';

/**
 * @middleware requireActiveSubscription
 * @description Checks if user has active access via personal subscription, team ownership, or team membership
 * Use this middleware on routes that require any form of active subscription
 */
export const requireActiveSubscription = async (req, res, next) => {
    try {
        const user = req.user;
        const now = new Date();
        let hasAccess = false;
        let accessType = null;
        let expiresAt = null;

        // Check 1: Team Owner
        if (user.isTeamOwner && user.ownedTeamSubscription) {
            const teamSub = await TeamSubscription.findById(user.ownedTeamSubscription);
            if (teamSub && 
                teamSub.subscriptionStatus === 'active' && 
                teamSub.currentPeriodEnd > now) {
                hasAccess = true;
                accessType = 'team_owner';
                expiresAt = teamSub.currentPeriodEnd;
            }
        }

        // Check 2: Personal Subscription
        if (!hasAccess && 
            user.subscriptionStatus === 'active' && 
            user.subscriptionExpiresAt && 
            user.subscriptionExpiresAt > now) {
            hasAccess = true;
            accessType = 'personal';
            expiresAt = user.subscriptionExpiresAt;
        }

        // Check 3: Team Member
        if (!hasAccess && user.isTeamMember && user.teamMembership) {
            const membership = await TeamMember.findById(user.teamMembership)
                .populate('teamSubscriptionId');
            
            if (membership && membership.status === 'active') {
                const teamSub = membership.teamSubscriptionId;
                
                // Check extended expiry first (from personal plan transition)
                if (user.extendedExpiryFromPersonalPlan && 
                    user.extendedExpiryFromPersonalPlan > now) {
                    hasAccess = true;
                    accessType = 'team_member_extended';
                    expiresAt = user.extendedExpiryFromPersonalPlan;
                }
                // Then check team subscription
                else if (teamSub && 
                    teamSub.subscriptionStatus === 'active' && 
                    teamSub.currentPeriodEnd > now) {
                    hasAccess = true;
                    accessType = 'team_member';
                    expiresAt = teamSub.currentPeriodEnd;
                }
            }
            
            // Check if removed but still has access
            if (!hasAccess && 
                membership && 
                membership.status === 'pending_removal' &&
                membership.accessExpiresAt > now) {
                hasAccess = true;
                accessType = 'team_member_grace';
                expiresAt = membership.accessExpiresAt;
            }
        }

        if (!hasAccess) {
            throw new ApiError(
                HttpStatusCode.FORBIDDEN,
                'Active subscription required. Please subscribe to access this resource.'
            );
        }

        // Attach access info to request for use in controllers
        req.subscriptionAccess = {
            type: accessType,
            expiresAt: expiresAt,
        };

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * @middleware requireTeamOwner
 * @description Ensures the user is a team owner with an active team subscription
 */
export const requireTeamOwner = async (req, res, next) => {
    try {
        const user = req.user;
        
        if (!user.isTeamOwner || !user.ownedTeamSubscription) {
            throw new ApiError(
                HttpStatusCode.FORBIDDEN,
                'You must be a team owner to access this resource.'
            );
        }

        const teamSub = await TeamSubscription.findById(user.ownedTeamSubscription);
        if (!teamSub || teamSub.subscriptionStatus !== 'active') {
            throw new ApiError(
                HttpStatusCode.FORBIDDEN,
                'Your team subscription is not active.'
            );
        }

        req.teamSubscription = teamSub;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * @middleware requirePersonalOrTeamOwner
 * @description Ensures user has personal subscription OR is a team owner (not team member)
 * Use this for features that should be available to paying customers only
 */
export const requirePersonalOrTeamOwner = async (req, res, next) => {
    try {
        const user = req.user;
        const now = new Date();
        let hasAccess = false;

        // Check team owner
        if (user.isTeamOwner && user.ownedTeamSubscription) {
            const teamSub = await TeamSubscription.findById(user.ownedTeamSubscription);
            if (teamSub && 
                teamSub.subscriptionStatus === 'active' && 
                teamSub.currentPeriodEnd > now) {
                hasAccess = true;
                req.accessType = 'team_owner';
            }
        }

        // Check personal subscription
        if (!hasAccess && 
            user.subscriptionStatus === 'active' && 
            user.subscriptionExpiresAt && 
            user.subscriptionExpiresAt > now) {
            hasAccess = true;
            req.accessType = 'personal';
        }

        if (!hasAccess) {
            throw new ApiError(
                HttpStatusCode.FORBIDDEN,
                'This feature requires a personal subscription or team ownership.'
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};


/**
 * @function isAuthenticated
 * @description Middleware to check if the user is authenticated via session.
 * If authenticated, proceeds to the next handler. Otherwise, sends a 401 Unauthorized error.
 * Relies on `passport.session()` middleware being set up.
 *
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 * @param {Express.NextFunction} next - Express next middleware function.
 */
export const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) { // req.isAuthenticated() is added by Passport
        return next();
    }
    next(new ApiError(HttpStatusCode.UNAUTHORIZED, AppMessages.UNAUTHORIZED));
};
