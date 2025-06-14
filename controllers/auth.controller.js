/**
 * @file controllers/auth.controller.js
 * @description Authentication controller for handling OAuth callbacks, logout, and user profile.
 * @author GIDE
 */

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { HttpStatusCode, AppMessages, PlanTypes } from '../constants/index.js';
import { bridge } from '../bridge.js';
import { Referral } from '../models/referral.model.js'; // Ensure Referral model is imported if needed for getCurrentUser

/**
 * @async
 * @function handleOAuthSuccess
 * @description Handles successful OAuth authentication. Redirects user to the frontend dashboard.
 * The actual user creation/login is handled by the Passport strategy.
 * This controller function is called *after* Passport successfully authenticates
 * and establishes a session.
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 */
const handleOAuthSuccess = asyncHandler(async (req, res) => {
    // Passport has already authenticated the user and req.user is populated.
    // A session is established.
    // Redirect to the frontend.
    const successRedirectUrl = `${bridge.FRONTEND_URL}/dashboard?login=success`; // Or any other success page
    res.redirect(successRedirectUrl);
});

/**
 * @async
 * @function handleOAuthFailure
 * @description Handles OAuth authentication failure. Redirects user to the frontend login page with an error.
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 */
const handleOAuthFailure = asyncHandler(async (req, res) => {
    const errorMessage = req.authInfo && req.authInfo.message
                         ? req.authInfo.message
                         : 'OAuth login failed. Please try again.';
    const failureRedirectUrl = `${bridge.FRONTEND_URL}/login?status=failed&message=${encodeURIComponent(errorMessage)}`;
    res.redirect(failureRedirectUrl);
});


/**
 * @async
 * @function logoutUser
 * @description Logs out the currently authenticated user.
 * Destroys the session and clears the session cookie.
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 * @param {Express.NextFunction} next - Express next middleware function.
 */
const logoutUser = asyncHandler(async (req, res, next) => {
    req.logout(function(err) {
        if (err) {
            console.error("Error during logout:", err);
            return next(new ApiError(HttpStatusCode.INTERNAL_SERVER_ERROR, 'Logout failed.'));
        }
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
            }
            res.clearCookie('connect.sid');
            return res
                .status(HttpStatusCode.OK)
                .json(new ApiResponse(HttpStatusCode.OK, {}, AppMessages.LOGOUT_SUCCESSFUL));
        });
    });
});

/**
 * @async
 * @function getCurrentUser
 * @description Retrieves the profile of the currently authenticated user.
 * Populates referral code information.
 * @param {Express.Request} req - Express request object, req.user should be populated by Passport.
 * @param {Express.Response} res - Express response object.
 */
const getCurrentUser = asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ApiError(HttpStatusCode.UNAUTHORIZED, AppMessages.UNAUTHORIZED);
    }
    const { _id, email, name, avatar, provider, subscriptionStatus, subscriptionExpiresAt, currentPlanType, referredBy, referralDetails, createdAt } = req.user;
    
   let userReferralCode = null;
    let userNumberOfReferrals = 0; // <-- Initialize to 0
    if (referralDetails) {
        const referralDoc = await Referral.findById(referralDetails);
        if (referralDoc) {
            userReferralCode = referralDoc.referralCode;
            userNumberOfReferrals = referralDoc.numberOfReferrals; 
        }
    }

    return res.status(HttpStatusCode.OK).json(new ApiResponse(HttpStatusCode.OK, {
        _id,
        email,
        name,
        avatar,
        provider,
        subscriptionStatus,
        subscriptionExpiresAt,
        currentPlanType,
        referredBy,
        userReferralCode,
        userNumberOfReferrals,
        createdAt,
        isLoggedIn: true
    }, AppMessages.FETCHED));
});

export const authController = {
    handleOAuthSuccess,
    handleOAuthFailure,
    logoutUser,
    getCurrentUser,
};