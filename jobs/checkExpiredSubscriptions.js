/**
 * @file jobs/checkExpiredSubscriptions.js
 * @description Scheduled job to check and update expired subscriptions
 * @author GIDE
 */

import { User } from '../models/user.model.js';
import { PlanTypes } from '../constants/index.js';

/**
 * Check for expired subscriptions and update user status
 */
export const checkExpiredSubscriptions = async () => {
    try {
        console.log('[CRON] Checking for expired subscriptions...');
        
        const now = new Date();
        
        // Find all users whose subscription has expired
        const expiredUsers = await User.find({
            subscriptionExpiresAt: { $lt: now },
            subscriptionStatus: { 
                $in: [
                    PlanTypes.FREE_TRIAL, 
                    PlanTypes.MONTHLY, 
                    PlanTypes.YEARLY,
                    PlanTypes.BONUS_EXTENSION,
                    'active'
                ] 
            }
        });

        if (expiredUsers.length === 0) {
            console.log('[CRON] No expired subscriptions found.');
            return;
        }

        console.log(`[CRON] Found ${expiredUsers.length} expired subscription(s). Updating...`);

        let updatedCount = 0;
        for (const user of expiredUsers) {
            const previousStatus = user.subscriptionStatus;
            const previousPlan = user.currentPlanType;
            
            user.subscriptionStatus = 'ended';
            user.currentPlanType = null;
            
            await user.save();
            updatedCount++;
            
            console.log(`[CRON] Updated user ${user.email}: ${previousPlan}/${previousStatus} -> expired/expired`);
        }

        console.log(`[CRON] Successfully updated ${updatedCount} expired subscription(s).`);
        
    } catch (error) {
        console.error('[CRON] Error checking expired subscriptions:', error);
    }
};