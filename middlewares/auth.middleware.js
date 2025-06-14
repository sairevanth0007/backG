/**
 * @file middlewares/auth.middleware.js
 * @description Authentication middleware to protect routes.
 * @author GIDE
 */

import { ApiError } from '../utils/ApiError.js';
import { HttpStatusCode, AppMessages } from '../constants/index.js';
import passport from 'passport'; // To use passport's isAuthenticated

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

// Optional: Middleware to check for specific roles if you implement them
// export const hasRole = (roles) => {
//     return (req, res, next) => {
//         if (!req.user || !roles.includes(req.user.role)) {
//             return next(new ApiError(HttpStatusCode.FORBIDDEN, AppMessages.FORBIDDEN));
//         }
//         next();
//     };
// };