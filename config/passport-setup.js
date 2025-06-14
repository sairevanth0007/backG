/**
 * @file config/passport-setup.js
 * @description Passport.js authentication strategies setup.
 * @author GIDE
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as GitHubStrategy } from 'passport-github2';
import mongoose from 'mongoose';

import { User } from '../models/user.model.js';
import { Referral } from '../models/referral.model.js';
import { bridge } from '../bridge.js';
import { PlanTypes, OAuthProviders, AppMessages, ReferralConstants } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import crypto from 'crypto';
// Helper function to add duration to a date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function addMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * @function passport.serializeUser
 * @description Determines which data of the user object should be stored in the session.
 * The result of the serializeUser method is attached to the session as req.session.passport.user = {value}.
 * @param {User} user - The user object provided by the strategy's verify callback.
 * @param {Function} done - Callback to tell Passport it's done.
 */
passport.serializeUser((user, done) => {
    done(null, user.id); // Store user.id in session
});

/**
 * @function passport.deserializeUser
 * @description Retrieves user data from the session.
 * The object stored in the session (user.id) is used to retrieve the full user object.
 * This full user object is then attached to the request as req.user.
 * @param {string} id - The user ID stored in the session.
 * @param {Function} done - Callback to tell Passport it's done.
 */
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user); // Attach user object to req.user
    } catch (error) {
        done(error, null);
    }
});

const OAUTH_VERIFY_CALLBACK = async (req, accessToken, refreshToken, profile, done) => {
    const provider = profile.provider;
    const providerId = profile.id;
    let email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    let name = profile.displayName || profile.username || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim();
    let avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

    // Fallback for GitHub if email is null (user might have private email)
    if (provider === OAuthProviders.GITHUB && !email && accessToken) {
        try {
            const res = await fetch('https://api.github.com/user/emails', {
                headers: { Authorization: `token ${accessToken}` },
            });
            const emails = await res.json();
            if (Array.isArray(emails) && emails.length > 0) {
                const primaryEmail = emails.find(e => e.primary && e.verified);
                email = primaryEmail ? primaryEmail.email : emails[0].email;
            }
        } catch (err) {
            console.error('Error fetching GitHub email:', err);
            return done(new ApiError(500, 'Failed to fetch email from GitHub.'));
        }
    }
    
    if (!email) {
        return done(null, false, { message: `Email not provided by ${provider}. Please ensure your ${provider} account has a public email.` });
    }
    if (!name) name = email.split('@')[0];

    const sessionReferralCode = req.session.referralCode;
    if (req.session.referralCode) delete req.session.referralCode;

    try {
        let user = await User.findOne({ provider: provider, providerId: providerId });

        if (user) {
            user.lastLoginAt = new Date();
            if (avatar && user.avatar !== avatar) user.avatar = avatar;
            if (name && user.name !== name) user.name = name;
            await user.save();
            return done(null, user);
        } else {
            const existingUserWithEmail = await User.findOne({ email: email });
            if (existingUserWithEmail) {
                return done(null, false, { message: `Email ${email} is already registered using ${existingUserWithEmail.provider}. Please login with ${existingUserWithEmail.provider} or use a different email.` });
            }

            const newUser = new User({
                email,
                name,
                avatar,
                provider,
                providerId,
                lastLoginAt: new Date(),
            });

            const freeTrialDurationDays = parseInt(process.env.DEFAULT_FREE_TRIAL_DURATION_DAYS, 10) || 30;
            newUser.subscriptionStatus = PlanTypes.FREE_TRIAL;
            newUser.currentPlanType = PlanTypes.FREE_TRIAL;
            newUser.subscriptionExpiresAt = addDays(new Date(), freeTrialDurationDays);
            newUser.hasUsedFreeTrial = true;
            newUser.isFreeTrialEligible = false;

            // 2. Handle incoming referral code (if any)
            if (sessionReferralCode) {
                const referralDoc = await Referral.findOne({ referralCode: sessionReferralCode }).populate('userId');
                if (referralDoc && referralDoc.userId) {
                    const referringUser = await User.findById(referralDoc.userId);

                    if (referringUser && referringUser._id.toString() !== newUser._id.toString()) {
                        // --- START OF NEW REFERRAL LIMIT LOGIC ---
                        if (referralDoc.numberOfReferrals < ReferralConstants.MAX_BONUS_REFERRALS) {
                            newUser.referredBy = referringUser._id;

                            let newExpiry;
                            if (!referringUser.subscriptionExpiresAt || referringUser.subscriptionExpiresAt < new Date()) {
                                newExpiry = addMonths(new Date(), ReferralConstants.BONUS_MONTHS);
                            } else {
                                newExpiry = addMonths(new Date(referringUser.subscriptionExpiresAt), ReferralConstants.BONUS_MONTHS);
                            }
                            referringUser.subscriptionExpiresAt = newExpiry;

                            await referringUser.save();

                            referralDoc.numberOfReferrals += 1;
                            await referralDoc.save();
                            console.log(`Referral bonus applied to user ${referringUser.email} from new user ${newUser.email}. Total bonuses for this referrer: ${referralDoc.numberOfReferrals}/${ReferralConstants.MAX_BONUS_REFERRALS}`);
                        } else {
                            console.log(`Referral bonus limit reached for user ${referringUser.email} (${referralDoc.numberOfReferrals} bonuses). No bonus applied for new user ${newUser.email}.`);
                        }
                        // --- END OF NEW REFERRAL LIMIT LOGIC ---
                    }
                } else {
                     console.warn(`Invalid or non-existent referral code used: ${sessionReferralCode}`);
                }
            }
            await newUser.save();

            // 3. Generate user's own referral code
            try {
                let uniqueCodeGenerated = false;
                let newReferralCode;
                let attempts = 0;
                const MAX_ATTEMPTS = 5;

                while(!uniqueCodeGenerated && attempts < MAX_ATTEMPTS) {
                    newReferralCode = Referral.generateReferralCode(newUser.name);
                    const existingCode = await Referral.findOne({ referralCode: newReferralCode});
                    if (!existingCode) {
                        uniqueCodeGenerated = true;
                    }
                    attempts++;
                }

                if (!uniqueCodeGenerated) {
                    newReferralCode = `REF${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
                }

                const userReferral = new Referral({
                    userId: newUser._id,
                    referralCode: newReferralCode,
                });
                await userReferral.save();
                newUser.referralDetails = userReferral._id;
                await newUser.save();
            } catch (referralError) {
                console.error(`Failed to create referral code for ${newUser.email}:`, referralError);
            }
            return done(null, newUser);
        }
    } catch (error) {
        console.error(`OAuth Error for ${provider} user ${email}:`, error);
        if (error.code === 11000) {
             return done(null, false, { message: AppMessages.USER_ALREADY_EXISTS });
        }
        return done(error);
    }
};



// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${bridge.BASE_URL}${process.env.GOOGLE_CALLBACK_URL}`, // e.g., http://localhost:8000/api/v1/auth/google/callback
    passReqToCallback: true, // Allows us to access req in the verify callback
}, OAUTH_VERIFY_CALLBACK));

// Microsoft Strategy
passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: `${bridge.BASE_URL}${process.env.MICROSOFT_CALLBACK_URL}`,
    scope: ['openid', 'profile', 'email', 'User.Read'], // Common scopes
    tenant: process.env.MICROSOFT_TENANT_ID || 'common',
    passReqToCallback: true,
}, OAUTH_VERIFY_CALLBACK));

// GitHub Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${bridge.BASE_URL}${process.env.GITHUB_CALLBACK_URL}`,
    scope: ['user:email', 'read:user'], // Scopes to get email and user profile
    passReqToCallback: true,
}, OAUTH_VERIFY_CALLBACK));

export default passport;