/**
 * @file app.js
 * @description Main application file for the Express server.
 * @author GIDE
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';

import connectDB from './config/db.js';
import './config/passport-setup.js';
import mainRouterV1 from './routes/index.routes.js';
import { bridge } from './bridge.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import { HttpStatusCode, AppMessages } from './constants/index.js';
import { rateLimiter } from './middlewares/rateLimiter.middleware.js'; // We'll create this next
import paymentRoutes from './routes/payment.routes.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerOptions from './config/swagger.js';
// Load environment variables
dotenv.config({
    path: './.env' // Explicitly point to .env if it's not automatically picked up
});

console.log('Current NODE_ENV:', process.env.NODE_ENV); // Add this
console.log('Bridge BASE_URL:', bridge.BASE_URL);       // Add this


// Initialize Express app
const app = express();

// Connect to Database
connectDB();

// --- Middlewares ---

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || bridge.FRONTEND_URL, // Allow requests from frontend
    credentials: true, // Allow cookies to be sent with requests
}));

// Helmet for security headers
app.use(helmet());

// Morgan for HTTP request logging (use 'combined' for production, 'dev' for development)
app.use(morgan(bridge.isProduction ? 'combined' : 'dev'));

// Express JSON and URL-encoded data parsing
app.use(express.json({ limit: '16kb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// Express Session (required for Passport OAuth persistent login sessions)
// Make sure SESSION_SECRET is strong and unique
app.use(session({
    secret: process.env.SESSION_SECRET || 'defaultfallbacksecretkey',
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    cookie: {
        secure: process.env.NGROK_URL ? true : bridge.isProduction, // True if HTTPS, false for HTTP (development)
        httpOnly: true, // Prevent client-side JS from reading the cookie
        maxAge: 24 * 60 * 60 * 1000 // 1 day (optional, can be shorter or longer)
    }
}));

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session()); // For persistent login sessions

// Rate Limiter (applied to all routes, can be more granular)
// We will define `rateLimiter` in middlewares/rateLimiter.middleware.js in the next step
// For now, placeholder:
app.use(rateLimiter); 

// --- Routes ---
app.use('/api/v1', mainRouterV1);

// --- Swagger Documentation Setup ---
// Generate Swagger specs based on options and JSDoc comments
const specs = swaggerJsdoc(swaggerOptions);

/**
 * @route GET /api-docs
 * @description Renders the Swagger UI for API documentation.
 * @group Documentation
 * @returns {void}
 */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));


// Simple health check route
app.get('/', (req, res) => {
    res.status(HttpStatusCode.OK).json({
        message: "Welcome to the API! It's alive!",
        environment: bridge.NODE_ENV,
        baseUrl: bridge.BASE_URL
    });
});

app.get('/api/v1/health', (req, res) => {
    res.status(HttpStatusCode.OK).json({
        status: 'UP',
        message: 'API Health is good!',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/v1/payment/webhook', express.raw({ type: 'application/json' }));

// --- Global Error Handler ---
// This must be the last middleware
app.use(errorHandler);


export default app; // Export app for server.js to start it

// --- Server Startup (moved to server.js or handled by app.listen if not using a separate server file) ---
// const port = bridge.SERVER_PORT;
// app.listen(port, () => {
//     console.log(`🚀 Server is running on ${bridge.BASE_URL}`);
//     console.log(`Environment: ${bridge.NODE_ENV}`);
// });