/**
 * @file bridge.js
 * @description Utility to determine environment-specific configurations.
 * @author Your Name
 */

import dotenv from 'dotenv';
dotenv.config(); // Ensure environment variables are loaded

const { NODE_ENV, PORT, CLIENT_URL } = process.env;

const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';

const SERVER_PORT = PORT || 8000;

/**
 * @constant {string} BASE_URL
 * @description Base URL for the backend API.
 * This is determined by NODE_ENV. In production, replace 'YOUR_PRODUCTION_API_URL' with your actual deployed API URL.
 */
const BASE_URL = isProduction ? 'YOUR_PRODUCTION_API_URL' : `http://localhost:${SERVER_PORT}`;

/**
 * @constant {string} FRONTEND_URL
 * @description Base URL for the frontend application. Used for redirects.
 */
const FRONTEND_URL = CLIENT_URL || 'http://localhost:3000'; // Default if not set

/**
 * @namespace bridge
 * @description Provides environment-specific configuration values and flags.
 */
export const bridge = {
    /**
     * @constant {string} NODE_ENV
     * @memberof bridge
     * @description The current Node.js environment (e.g., 'development', 'production', 'test').
     */
    NODE_ENV,
    /**
     * @constant {boolean} isProduction
     * @memberof bridge
     * @description True if the environment is production.
     */
    isProduction,
    /**
     * @constant {boolean} isDevelopment
     * @memberof bridge
     * @description True if the environment is development.
     */
    isDevelopment,
    /**
     * @constant {boolean} isTest
     * @memberof bridge
     * @description True if the environment is test.
     */
    isTest,
    /**
     * @constant {number} SERVER_PORT
     * @memberof bridge
     * @description The port number the server is running on.
     */
    SERVER_PORT,
    /**
     * @constant {string} BASE_URL
     * @memberof bridge
     * @description Base URL for the backend API based on the current environment.
     */
    BASE_URL,
    /**
     * @constant {string} FRONTEND_URL
     * @memberof bridge
     * @description Base URL for the frontend application.
     */
    FRONTEND_URL,
};