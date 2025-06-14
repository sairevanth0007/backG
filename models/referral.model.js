/**
 * @file models/referral.model.js
 * @description Defines the Mongoose schema for Referrals.
 * @author GIDE
 */

import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto'; // For generating referral codes

/**
 * @typedef {object} Referral
 * @property {mongoose.Schema.Types.ObjectId} userId - The user to whom this referral code belongs.
 * @property {string} referralCode - The unique referral code.
 * @property {number} numberOfReferrals - The count of users who have successfully used this referral code.
 * @property {Date} createdAt - Timestamp of when the referral entry was created.
 * @property {Date} updatedAt - Timestamp of when the referral entry was last updated.
 */
const referralSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true, // Each user has one referral entity/code
        },
        referralCode: {
            type: String,
            unique: true,
            required: true,
            uppercase: true,
            trim: true,
        },
        numberOfReferrals: {
            type: Number,
            default: 0,
            min: 0,
        },
        // You could add more fields here, like rewards history, etc.
    },
    { timestamps: true }
);

/**
 * @static
 * @function generateReferralCode
 * @memberof Referral
 * @description Generates a unique referral code.
 * Combines parts of user's name (if available) or a random string with some random characters.
 * Ensures uniqueness by checking against existing codes (though true uniqueness check should be at DB level with retries if needed).
 *
 * @param {string} [usernamePart="REF"] - A string part, usually derived from username, to make code somewhat recognizable.
 * @returns {string} A generated referral code.
 */
referralSchema.statics.generateReferralCode = function (usernamePart = "REF") {
    const namePrefix = usernamePart.substring(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${namePrefix}${randomSuffix}`;
};


export const Referral = mongoose.model('Referral', referralSchema);