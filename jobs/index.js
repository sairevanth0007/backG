/**
 * @file jobs/index.js
 * @description Job scheduler setup using node-cron
 * @author GIDE
 */

import cron from 'node-cron';
import { checkExpiredSubscriptions } from './checkExpiredSubscriptions.js';

/**
 * Initialize all scheduled jobs
 */
export const initializeJobs = () => {
    console.log('[JOBS] Initializing scheduled jobs...');

    // Run every day at 12:00 AM (midnight)
    cron.schedule('0 0 * * *', async () => {
        console.log('[JOBS] Running daily subscription check...');
        await checkExpiredSubscriptions();
    });

    // OPTIONAL: Run every hour (useful for testing or more frequent checks)
    // cron.schedule('0 * * * *', async () => {
    //     console.log('[JOBS] Running hourly subscription check...');
    //     await checkExpiredSubscriptions();
    // });

    // For testing: Run every minute (REMOVE IN PRODUCTION)
    // cron.schedule('* * * * *', async () => {
    //     console.log('[JOBS] Running test subscription check...');
    //     await checkExpiredSubscriptions();
    // });

    console.log('[JOBS] Scheduled jobs initialized successfully.');
};

// /***
//  * Cron schedule format:
//  * ┌────────────── second (optional, 0-59)
//  * │ ┌──────────── minute (0-59)
//  * │ │ ┌────────── hour (0-23)
//  * │ │ │ ┌──────── day of month (1-31)
//  * │ │ │ │ ┌────── month (1-12)
//  * │ │ │ │ │ ┌──── day of week (0-7, 0 and 7 are Sunday)
//  * │ │ │ │ │ │
//  * * * * * * *
//  * 
//  * Examples:
//  * '0 0 * * *'     - Every day at midnight
//  * '0 */6 * * *'   - Every 6 hours
//  * '0 0 */2 * *'   - Every 2 days at midnight
//  * '0 9 * * 1'     - Every Monday at 9 AM
//  * '*/30 * * * *'  - Every 30 minutes
//  **/