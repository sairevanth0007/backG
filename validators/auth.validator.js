/**
 * @file validators/auth.validator.js
 * @description Joi validation schemas for authentication-related inputs.
 * @author GIDE
 */

import Joi from 'joi';

// For now, OAuth doesn't require direct input validation schemas for login/signup
// as data comes from providers. These are placeholders or for future use.

/**
 * @const validateReferralCodeSchema
 * @description Joi schema for validating a referral code input.
 * This might be used if a user can manually enter a referral code post-signup or during.
 */
export const validateReferralCodeSchema = Joi.object({
    referralCode: Joi.string()
        .trim()
        .alphanum()
        .uppercase()
        .min(6)
        .max(15)
        .required()
        .messages({
            'string.base': 'Referral code must be a string.',
            'string.empty': 'Referral code cannot be empty.',
            'string.alphanum': 'Referral code must only contain alphanumeric characters.',
            'string.uppercase': 'Referral code must be in uppercase.',
            'string.min': 'Referral code must be at least {#limit} characters long.',
            'string.max': 'Referral code must be at most {#limit} characters long.',
            'any.required': 'Referral code is required.',
        }),
});

// If you were to add an endpoint for users to update their profile (e.g., name):
export const updateUserProfileSchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Name must be at least 2 characters long.',
            'string.max': 'Name cannot exceed 100 characters.',
        }),
    // Add other updatable fields here
});


// Example: If you needed to validate parameters for initiating an OAuth flow (less common)
// export const oauthInitiateSchema = Joi.object({
//     provider: Joi.string().valid('google', 'github', 'microsoft').required(),
//     // any other params like redirect_uri if you allow dynamic ones (be careful)
// });