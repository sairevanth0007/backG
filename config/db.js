/**
 * @file config/db.js
 * @description MongoDB connection setup.
 * @author GIDE
 */

import mongoose from 'mongoose';
import { DB_NAME } from '../constants/index.js';
import { bridge } from '../bridge.js'; // Ensure bridge is imported
import { initializeJobs } from '../jobs/index.js';
/**
 * @async
 * @function connectDB
 * @description Establishes a connection to the MongoDB database using Mongoose.
 * It uses the `MONGODB_URI` from environment variables and the `DB_NAME` constant.
 * Enables Mongoose debug mode in development.
 * Exits the process with failure code 1 if connection fails.
 * @returns {Promise<void>} A promise that resolves when the connection is successful.
 * @throws {Error} If MongoDB connection fails.
 */
const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n☘️  MongoDB Connected! DB HOST: ${connectionInstance.connection.host}\n   Database: ${DB_NAME}`);
        if (bridge.isDevelopment) {
            mongoose.set('debug', true); // Enable Mongoose debug mode in development
        }
        // Initialize scheduled jobs AFTER DB connection
        initializeJobs();
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
        process.exit(1); // Exit process with failure
    }
};

export default connectDB;