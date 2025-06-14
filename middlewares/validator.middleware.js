/**
 * @file middlewares/validator.middleware.js
 * @description Joi validation middleware.
 * @author Your Name
 */

import Joi from 'joi';
import { ApiError } from '../utils/ApiError.js';
import { HttpStatusCode } from '../constants/index.js';

/**
 * @function validate
 * @description Middleware to validate request data (body, query, params) against a Joi schema.
 *
 * @param {Joi.Schema} schema - The Joi schema to validate against.
 * @param {('body'|'query'|'params')} [dataSource='body'] - The part of the request object to validate.
 * @returns {Function} Express middleware function.
 *
 * @example
 * // In your route:
 * // import { validate } from '../middlewares/validator.middleware.js';
 * // import { someSchema } from '../validators/some.validator.js';
 * // router.post('/some-endpoint', validate(someSchema), someController.handler);
 * // router.get('/another-endpoint', validate(anotherSchema, 'query'), anotherController.handler);
 */
export const validate = (schema, dataSource = 'body') => {
    return (req, res, next) => {
        const dataToValidate = req[dataSource];

        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false, // Return all errors, not just the first
            stripUnknown: true, // Remove unknown keys from the validated data
        });

        if (error) {
            const errorMessages = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/['"]/g, ''), // Clean up quotes from Joi messages
            }));
            return next(new ApiError(HttpStatusCode.UNPROCESSABLE_ENTITY, 'Validation Error', errorMessages));
        }

        // Attach validated data to the request object (e.g., req.validatedBody)
        // This ensures that controllers use the sanitized and validated data.
        req[`validated${dataSource.charAt(0).toUpperCase() + dataSource.slice(1)}`] = value;
        // Or simply overwrite req[dataSource] if preferred, but explicit is often clearer.
        // req[dataSource] = value;

        next();
    };
};