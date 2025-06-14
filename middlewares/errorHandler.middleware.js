/**
 * @file middlewares/errorHandler.middleware.js
 * @description Global error handling middleware for Express.
 * @author GIDE
 */

import { ApiError } from '../utils/ApiError.js';
import { HttpStatusCode } from '../constants/index.js';
import { bridge } from '../bridge.js';

/**
 * @function errorHandler
 * @description Express error handling middleware.
 * It catches errors passed by `next(err)` and sends a standardized JSON response.
 *
 * @param {Error|ApiError} err - The error object.
 * @param {Express.Request} req - Express request object.
 * @param {Express.Response} res - Express response object.
 * @param {Express.NextFunction} next - Express next middleware function.
 */
const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || HttpStatusCode.INTERNAL_SERVER_ERROR;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || [];

    // Handle specific Mongoose errors (optional, but good for user feedback)
    if (err.name === 'CastError') {
        statusCode = HttpStatusCode.BAD_REQUEST;
        message = `Invalid ${err.path}: ${err.value}.`;
        errors = [{ field: err.path, message }];
    } else if (err.name === 'ValidationError') {
        statusCode = HttpStatusCode.UNPROCESSABLE_ENTITY;
        const validationErrors = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
        message = 'Validation failed.';
        errors = validationErrors;
    } else if (err.code === 11000) { // Mongoose duplicate key error
        statusCode = HttpStatusCode.CONFLICT;
        // Extract field name from error message (this can be brittle, adjust if needed)
        const field = Object.keys(err.keyValue)[0];
        message = `Duplicate field value entered for: ${field}. Please use another value.`;
        errors = [{ field, message }];
    }

    // If not an ApiError instance, and in development, log the full error
    if (!(err instanceof ApiError) && bridge.isDevelopment) {
        console.error("Server Error:", err);
    }
    
    // For production, don't send stack trace or overly detailed errors unless intended
    const response = {
        success: false,
        message,
        errors: errors.length ? errors : undefined, // Only include errors array if it has content
        ...(bridge.isDevelopment && { stack: err.stack }) // Include stack in development
    };

    res.status(statusCode).json(response);
};

export { errorHandler };