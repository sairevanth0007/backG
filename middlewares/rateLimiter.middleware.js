/**
 * @file middlewares/rateLimiter.middleware.js
 * @description Rate limiting middleware using express-rate-limit.
 * @author GIDE
 */

import rateLimit from 'express-rate-limit';
import { HttpStatusCode, AppMessages } from '../constants/index.js';
import { bridge } from '../bridge.js';

// Read configuration from .env or use defaults
const windowMs = (parseInt(process.env.DEFAULT_WINDOW_MS, 10) || 15) * 60 * 1000; // 15 minutes by default
const maxRequests = parseInt(process.env.DEFAULT_MAX_REQUESTS, 10) || 100; // 100 requests per windowMs by default

/**
 * @constant rateLimiter
 * @description General purpose rate limiter for all API routes.
 * It limits each IP to `maxRequests` requests per `windowMs`.
 *
 * @see {@link https://www.npmjs.com/package/express-rate-limit} for more configuration options.
 */
export const rateLimiter = rateLimit({
    windowMs: windowMs,
    max: maxRequests,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: (req, res) => {
        // Custom message function to ensure JSON response
        // This function is called when the limit is exceeded.
        // Directly sending response here to bypass default HTML.
        // However, the standard way is to let it throw an error
        // and handle it in a custom handler if more control is needed.
        // For simplicity, a direct JSON response is used.
        return res.status(HttpStatusCode.TOO_MANY_REQUESTS).json({
            success: false,
            message: AppMessages.ERROR_DEFAULT, // Or a more specific "Too many requests" message
            errors: [
                {
                    message: `Too many requests created from this IP, please try again after ${windowMs / 60000} minutes.`,
                },
            ],
        });
    },
    handler: (req, res, next, options) => {
        // This handler is invoked when a request is rate-limited.
        // It's an alternative to the `message` option for more complex logic.
        // Here, we ensure a JSON response.
        res.status(options.statusCode).json({ // options.statusCode is HttpStatusCode.TOO_MANY_REQUESTS
            success: false,
            message: options.message.message || `Too many requests, please try again later. You have exceeded the ${options.max} requests in ${options.windowMs / 60000} minutes limit!`,
            // errors: [{ message: options.message }], // options.message would be the output of the message function or string
        });
    },
    skip: (req, res) => {
        // Optionally skip rate limiting for certain conditions
        // For example, allow more requests from authenticated users or specific IPs
        // if (req.isAuthenticated && req.isAuthenticated()) return true; // Example for authenticated users
        return bridge.isTest; // Skip rate limiting in test environment
    },
});

/**
 * @function createRateLimiter
 * @description Creates a custom rate limiter with specific options.
 * This allows for different rate limits on different routes if needed.
 *
 * @param {number} customWindowMs - The time window in milliseconds.
 * @param {number} customMaxRequests - The maximum number of requests allowed in the window.
 * @param {string} [customMessage="Too many requests, please try again later."] - Custom message for rate-limited responses.
 * @returns {Function} Express rate limit middleware instance.
 *
 * @example
 * // In your route file:
 * // import { createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
 * // const loginRateLimiter = createRateLimiter(5 * 60 * 1000, 5, "Too many login attempts. Please try again in 5 minutes.");
 * // router.post('/login', loginRateLimiter, authController.login);
 */
export const createRateLimiter = (customWindowMs, customMaxRequests, customMessage = "Too many requests, please try again later.") => {
    return rateLimit({
        windowMs: customWindowMs,
        max: customMaxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: customMessage,
        },
        handler: (req, res, next, options) => {
             res.status(options.statusCode).json({
                success: false,
                message: options.message.message || customMessage,
            });
        },
    });
};