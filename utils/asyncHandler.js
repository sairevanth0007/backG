/**
 * @file utils/asyncHandler.js
 * @description Utility to handle asynchronous route handlers and catch errors.
 * @author GIDE
 */

/**
 * @function asyncHandler
 * @description Wraps an asynchronous request handler function to automatically catch errors
 * and pass them to the next error-handling middleware.
 *
 * @param {Function} requestHandler - The asynchronous route handler function.
 * @returns {Function} A new function that handles promise resolution and rejection.
 *
 * @example
 * import { asyncHandler } from "../utils/asyncHandler.js";
 * router.get("/some-route", asyncHandler(async (req, res, next) => {
 *   // Your async logic here
 *   const data = await someAsyncOperation();
 *   res.status(200).json(new ApiResponse(200, data, "Data fetched"));
 * }));
 */
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
    };
};

export { asyncHandler };