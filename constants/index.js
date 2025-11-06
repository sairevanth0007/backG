/**
 * @file constants/index.js
 * @description Application-wide constants.
 * @author GIDE
 */

/**
 * @constant {string} DB_NAME
 * @description The name of the MongoDB database.
 */
export const DB_NAME = "my_app_db_main"; // Or derive from MONGODB_URI if preferred

/**
 * @constant {object} HttpStatusCode
 * @description Standard HTTP status codes.
 * @readonly
 * @enum {number}
 */
export const HttpStatusCode = Object.freeze({
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
});

/**
 * @constant {object} AppMessages
 * @description Standard application-wide messages for API responses.
 * @readonly
 * @enum {string}
 */
export const AppMessages = Object.freeze({
    SUCCESS: 'Success',
    CREATED: 'Resource created successfully',
    FETCHED: 'Resource fetched successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    ERROR_DEFAULT: 'An unexpected error occurred. Please try again later.',
    INVALID_INPUT: 'Invalid input provided.',
    NOT_FOUND: 'Resource not found.',
    UNAUTHORIZED: 'Unauthorized access. Please login.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    USER_ALREADY_EXISTS: 'User with this email already exists.',
    LOGIN_SUCCESSFUL: 'Login successful.',
    LOGOUT_SUCCESSFUL: 'Logout successful.',
    INVALID_CREDENTIALS: 'Invalid credentials.',
    PAYMENT_SUCCESSFUL: 'Payment successful.',
    PAYMENT_FAILED: 'Payment failed.',
    SUBSCRIPTION_ACTIVE: 'Subscription is active.',
    SUBSCRIPTION_CANCELED: 'Subscription canceled.',
    SUBSCRIPTION_UPDATED: 'Subscription updated.',
    REFERRAL_APPLIED: 'Referral applied successfully.',
    INVALID_REFERRAL_CODE: 'Invalid or expired referral code.',
});

/**
 * @constant {object} OAuthProviders
 * @description Supported OAuth providers.
 * @readonly
 * @enum {string}
 */
export const OAuthProviders = Object.freeze({
    GOOGLE: 'google',
    MICROSOFT: 'microsoft',
    GITHUB: 'github',
});

/**
 * @constant {object} PlanTypes
 * @description Types of subscription plans.
 * @readonly
 * @enum {string}
 */
export const PlanTypes = Object.freeze({
    MONTHLY: 'Monthly',
    YEARLY: 'Yearly',
    FREE_TRIAL: 'FreeTrial',
    BONUS_EXTENSION: 'BonusExtension', 
});

/**
 * @constant {object} UserRoles
 * @description User roles within the application.
 * @readonly
 * @enum {string}
 */
export const UserRoles = Object.freeze({
    USER: 'user',
    ADMIN: 'admin', // If you plan to have admin roles
});

// ADD THIS NEW CONSTANT FOR REFERRAL LIMITS
export const ReferralConstants = Object.freeze({
    MAX_BONUS_REFERRALS: 20, // Referrer gets bonus only for the first 20 referrals
    BONUS_MONTHS: 1,         // Number of months to add per referral
});