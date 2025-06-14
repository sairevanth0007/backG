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


// --- OAuth Callback Routes ---
const oauthCallbackOptions = {
    failureRedirect: `${bridge.BASE_URL}/api/v1/auth/oauth/failure`,
};

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback URL.
 *     description: Endpoint for Google to redirect back after user authentication. Handled internally by Passport.
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirects to frontend dashboard on success or login page on failure.
 */
router.get('/google/callback',
    passport.authenticate(OAuthProviders.GOOGLE, oauthCallbackOptions),
    authController.handleOAuthSuccess
);

/**
 * @swagger
 * /auth/microsoft/callback:
 *   get:
 *     summary: Microsoft OAuth callback URL.
 *     description: Endpoint for Microsoft to redirect back after user authentication. Handled internally by Passport.
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirects to frontend dashboard on success or login page on failure.
 */
router.get('/microsoft/callback',
    passport.authenticate(OAuthProviders.MICROSOFT, oauthCallbackOptions),
    authController.handleOAuthSuccess
);

/**
 * @swagger
 * /auth/github/callback:
 *   get:
 *     summary: GitHub OAuth callback URL.
 *     description: Endpoint for GitHub to redirect back after user authentication. Handled internally by Passport.
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirects to frontend dashboard on success or login page on failure.
 */
router.get('/github/callback',
    passport.authenticate(OAuthProviders.GITHUB, oauthCallbackOptions),
    authController.handleOAuthSuccess
);

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