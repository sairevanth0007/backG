/**
 * @file routes/index.routes.js
 * @description Main router for API v1. Aggregates all other route modules.
 * @author GIDE
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import paymentRoutes from './payment.routes.js'; // To be added later

const router = Router();

// Mount auth routes
router.use('/auth', authRoutes);
router.use('/payment', paymentRoutes);

// Mount payment routes (placeholder for now)
// router.use('/payment', paymentRoutes);

// Test route for the main API router
router.get('/', (req, res) => {
    res.json({ message: "Welcome to API v1" });
});

export default router;