/**
 * @file routes/auth.routes.js
 * @description Authentication routes for OAuth login, logout, and user profile.
 * @author GIDE
 */

import { Router } from 'express';
import passport from 'passport';
import { authController } from '../controllers/auth.controller.js';
import { isAuthenticated } from '../middlewares/auth.middleware.js';
import { bridge } from '../bridge.js';
import { OAuthProviders } from '../constants/index.js'; // Ensure OAuthProviders is imported

const router = Router();

// --- OAuth Initiation Routes ---
const initiateOAuth = (provider, scope) => (req, res, next) => {
    const { referralCode } = req.query;
    if (referralCode) {
        req.session.referralCode = referralCode.toString().trim().toUpperCase();
    }
    passport.authenticate(provider, { scope })(req, res, next);
};

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiates Google OAuth authentication.
 *     description: Redirects the user to Google's consent screen for login/signup. Supports optional referral code.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: referralCode
 *         schema:
 *           type: string
 *         description: Optional referral code to be applied during new user signup.
 *         example: JOHNDOE123
 *     responses:
 *       302:
 *         description: Redirects to Google OAuth.
 */
router.get('/google', initiateOAuth(OAuthProviders.GOOGLE, ['profile', 'email']));

/**
 * @swagger
 * /auth/microsoft:
 *   get:
 *     summary: Initiates Microsoft OAuth authentication.
 *     description: Redirects the user to Microsoft's consent screen for login/signup. Supports optional referral code.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: referralCode
 *         schema:
 *           type: string
 *         description: Optional referral code to be applied during new user signup.
 *         example: REFERREDUSER
 *     responses:
 *       302:
 *         description: Redirects to Microsoft OAuth.
 */
router.get('/microsoft', initiateOAuth(OAuthProviders.MICROSOFT, ['openid', 'profile', 'email', 'User.Read']));

/**
 * @swagger
 * /auth/github:
 *   get:
 *     summary: Initiates GitHub OAuth authentication.
 *     description: Redirects the user to GitHub's consent screen for login/signup. Supports optional referral code.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: referralCode
 *         schema:
 *           type: string
 *         description: Optional referral code to be applied during new user signup.
 *         example: GITHUBREF
 *     responses:
 *       302:
 *         description: Redirects to GitHub OAuth.
 */
router.get('/github', initiateOAuth(OAuthProviders.GITHUB, ['user:email', 'read:user']));


/**
 * @function handlePassportCallback
 * @description A reusable middleware to handle Passport.js authentication results.
 * It manually redirects to the frontend with success or specific error messages.
 * @param {string} provider - The name of the OAuth provider ('google', 'microsoft', 'github').
 * @returns {Function} Express middleware.
 */
const handlePassportCallback = (provider) => (req, res, next) => {
    passport.authenticate(provider, (err, user, info) => {
        // 'err' indicates a server-side error during authentication (e.g., network issue, misconfiguration)
        if (err) {
            console.error(`Passport authentication error for ${provider}:`, err);
            return res.redirect(`${bridge.FRONTEND_URL}/login?status=failed&message=${encodeURIComponent('Authentication failed due to server error. Please try again.')}`);
        }

        // 'user' is false if authentication failed, 'info' contains the message from done(null, false, info)
        if (!user) {
            const errorMessage = info && info.message ? info.message : 'OAuth login failed. Please try again.';
            console.warn(`OAuth authentication failure for ${provider}:`, errorMessage);
            return res.redirect(`${bridge.FRONTEND_URL}/login?status=failed&message=${encodeURIComponent(errorMessage)}`);
        }

        // Authentication successful, log the user in to establish a session
        req.logIn(user, (loginErr) => { // req.logIn is a Passport helper
            if (loginErr) {
                console.error(`Error logging in user after ${provider} success:`, loginErr);
                return res.redirect(`${bridge.FRONTEND_URL}/login?status=failed&message=${encodeURIComponent('Login successful, but session setup failed. Please try again.')}`);
            }
            // User successfully logged in and session established, redirect to dashboard
            return res.redirect(`${bridge.FRONTEND_URL}/dashboard?login=success`);
        });
    })(req, res, next); // This syntax is crucial: it calls the passport.authenticate middleware
};

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback URL.
 *     description: Endpoint for Google to redirect back after user authentication. Handled internally by Passport, redirects to frontend.
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirects to frontend dashboard on success or login page on failure with error message.
 */
router.get('/google/callback', handlePassportCallback(OAuthProviders.GOOGLE));

/**
 * @swagger
 * /auth/microsoft/callback:
 *   get:
 *     summary: Microsoft OAuth callback URL.
 *     description: Endpoint for Microsoft to redirect back after user authentication. Handled internally by Passport, redirects to frontend.
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirects to frontend dashboard on success or login page on failure with error message.
 */
router.get('/microsoft/callback', handlePassportCallback(OAuthProviders.MICROSOFT));

/**
 * @swagger
 * /auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback URL.
 *     description: Endpoint for GitHub to redirect back after user authentication. Handled internally by Passport, redirects to frontend.
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirects to frontend dashboard on success or login page on failure with error message.
 */
router.get('/github/callback', handlePassportCallback(OAuthProviders.GITHUB));

// --- OAuth Failure Route (Optional fallback, can be removed if specific handlers cover all cases) ---
// Keep this if you want a generic /oauth/failure route for scenarios not caught by specific callbacks.
// The `handleOAuthFailure` controller already expects a `message` query param.
/**
 * @swagger
 * /auth/oauth/failure:
 *   get:
 *     summary: Generic OAuth failure handler.
 *     description: Redirects to frontend login page with an error message in case of OAuth failure.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: message
 *         schema:
 *           type: string
 *         description: Error message from the OAuth failure.
 *     responses:
 *       302:
 *         description: Redirects to frontend login page.
 */
router.get('/oauth/failure', authController.handleOAuthFailure);

/**
 * @swagger
 * /auth/oauth/failure:
 *   get:
 *     summary: Generic OAuth failure handler.
 *     description: Redirects to frontend login page with an error message in case of OAuth failure.
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: message
 *         schema:
 *           type: string
 *         description: Error message from the OAuth failure.
 *     responses:
 *       302:
 *         description: Redirects to frontend login page.
 */
router.get('/oauth/failure', authController.handleOAuthFailure);


/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logs out the current user.
 *     description: Destroys the user session and clears authentication cookies. Requires user to be authenticated.
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               statusCode: 200
 *               data: {}
 *               message: "Logout successful."
 *               success: true
 *       401:
 *         description: Unauthorized if user is not logged in.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *             example:
 *               success: false
 *               message: "Unauthorized access. Please login."
 *               statusCode: 401
 *               errors: null
 *       500:
 *         description: Internal server error if logout fails.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.post('/logout', isAuthenticated, authController.logoutUser);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Retrieves the profile of the currently authenticated user.
 *     description: Returns the logged-in user's details, including subscription status and referral code.
 *     tags:
 *       - Auth
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             example:
 *               statusCode: 200
 *               data:
 *                 _id: "60c72b2f9f1b2c001c8e4d6a"
 *                 email: "user@example.com"
 *                 name: "John Doe"
 *                 avatar: "https://example.com/avatar.jpg"
 *                 provider: "google"
 *                 subscriptionStatus: "FreeTrial"
 *                 subscriptionExpiresAt: "2024-07-20T12:00:00.000Z"
 *                 currentPlanType: "FreeTrial"
 *                 referredBy: null
 *                 userReferralCode: "JOHNDOE123"
 *                 userNumberOfReferrals: 5
 *                 createdAt: "2024-06-20T12:00:00.000Z"
 *                 isLoggedIn: true
 *               message: "Resource fetched successfully."
 *               success: true
 *       401:
 *         description: Unauthorized if user is not logged in.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */
router.get('/me', isAuthenticated, authController.getCurrentUser);

export default router;