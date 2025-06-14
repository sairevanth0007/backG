/**
 * @file utils/ApiError.js
 * @description Custom Error class for API errors.
 * @author GIDE
 */

/**
 * @class ApiError
 * @extends Error
 * @description Represents an API error with a status code, message, and optional details.
 *
 * @param {number} statusCode - HTTP status code for the error.
 * @param {string} message - Error message.
 * @param {Array} errors - Optional array of detailed error messages or objects.
 * @param {string} stack - Optional error stack trace.
 */
class ApiError extends Error {
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ) {
        super(message);
        this.statusCode = statusCode;
        this.data = null; // To maintain consistency with ApiResponse
        this.message = message;
        this.success = false;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };