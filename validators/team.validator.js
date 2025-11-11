/**
 * @file validators/team.validator.js
 * @description Validation schemas for team management endpoints.
 */

import Joi from 'joi';

// Constants (hardcoded here to avoid import issues)
const MIN_SEATS = 1;
const MAX_SEATS = 20;

/**
 * Validate team checkout request
 */
export const validateTeamCheckoutSchema = Joi.object({
    planId: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid plan ID format.',
            'any.required': 'Plan ID is required.',
        }),
    seats: Joi.number()
        .integer()
        .min(MIN_SEATS)
        .max(MAX_SEATS)
        .required()
        .messages({
            'number.min': `Minimum ${MIN_SEATS} seat required.`,
            'number.max': `Maximum ${MAX_SEATS} seats allowed.`,
            'any.required': 'Number of seats is required.',
        }),
});

/**
 * Validate add team member request
 */
export const validateAddMemberSchema = Joi.object({
    memberEmail: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address.',
            'any.required': 'Member email is required.',
        }),
});

/**
 * Validate remove team member request
 */
export const validateRemoveMemberSchema = Joi.object({
    memberId: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid member ID format.',
            'any.required': 'Member ID is required.',
        }),
});

/**
 * Validate transfer ownership request
 */
export const validateTransferOwnershipSchema = Joi.object({
    newOwnerEmail: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address.',
            'any.required': 'New owner email is required.',
        }),
});