/**
 * @file validators/payment.validator.js
 * @description Joi validation schemas for payment-related inputs.
 * @author Your Name
 */

import Joi from 'joi';
import mongoose from 'mongoose'; // To validate MongoDB ObjectIds

/**
 * @const validatePlanIdSchema
 * @description Joi schema for validating a MongoDB ObjectId as a planId.
 */
export const validatePlanIdSchema = Joi.object({
    planId: Joi.string()
        .custom((value, helpers) => {
            if (!mongoose.Types.ObjectId.isValid(value)) {
                return helpers.error('any.invalid');
            }
            return value;
        }, 'MongoDB ObjectId validation')
        .required()
        .messages({
            'string.empty': 'Plan ID cannot be empty.',
            'any.required': 'Plan ID is required.',
            'any.invalid': 'Invalid Plan ID format.',
        }),
});