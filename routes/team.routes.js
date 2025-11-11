/**
 * @file routes/team.routes.js
 * @description Team subscription management routes.
 */

import { Router } from 'express';
import { teamController } from '../controllers/team.controller.js';
import { isAuthenticated } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validator.middleware.js';
import { 
    validateTeamCheckoutSchema,
    validateAddMemberSchema,
    validateRemoveMemberSchema,
    validateTransferOwnershipSchema
} from '../validators/team.validator.js';

const router = Router();

/**
 * @swagger
 * /team/create-checkout:
 *   post:
 *     summary: Create team subscription checkout session
 *     description: Creates a Stripe Checkout session for Small Business team subscription with specified seats
 *     tags:
 *       - Team
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - seats
 *             properties:
 *               planId:
 *                 type: string
 *                 description: MongoDB ID of the Small Business plan
 *               seats:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 20
 *                 description: Number of seats to purchase
 *     responses:
 *       200:
 *         description: Checkout session created successfully
 *       400:
 *         description: Bad request (invalid plan, seats out of range, already owns team)
 *       401:
 *         description: Unauthorized
 */
router.post(
    '/create-checkout',
    isAuthenticated,
    validate(validateTeamCheckoutSchema),
    teamController.createTeamCheckoutSession
);

/**
 * @swagger
 * /team/members/add:
 *   post:
 *     summary: Add a team member
 *     description: Add a registered user to the team subscription by email
 *     tags:
 *       - Team
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberEmail
 *             properties:
 *               memberEmail:
 *                 type: string
 *                 format: email
 *                 description: Email of the user to add (must be registered)
 *     responses:
 *       200:
 *         description: Team member added successfully
 *       400:
 *         description: Bad request (no seats available, user already member, etc.)
 *       403:
 *         description: Not a team owner
 *       404:
 *         description: User not found
 */
router.post(
    '/members/add',
    isAuthenticated,
    validate(validateAddMemberSchema),
    teamController.addTeamMember
);

/**
 * @swagger
 * /team/members/remove:
 *   post:
 *     summary: Remove a team member
 *     description: Remove a team member (access remains until end of billing period)
 *     tags:
 *       - Team
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *             properties:
 *               memberId:
 *                 type: string
 *                 description: TeamMember document ID to remove
 *     responses:
 *       200:
 *         description: Team member removed successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Not a team owner
 *       404:
 *         description: Team member not found
 */
router.post(
    '/members/remove',
    isAuthenticated,
    validate(validateRemoveMemberSchema),
    teamController.removeTeamMember
);

/**
 * @swagger
 * /team/members:
 *   get:
 *     summary: Get all team members
 *     description: Retrieve list of all team members for the owner's team
 *     tags:
 *       - Team
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Team members list
 *       403:
 *         description: Not a team owner
 */
router.get(
    '/members',
    isAuthenticated,
    teamController.getTeamMembers
);

/**
 * @swagger
 * /team/transfer-ownership:
 *   post:
 *     summary: Transfer team ownership
 *     description: Transfer ownership of the team subscription to another team member
 *     tags:
 *       - Team
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newOwnerEmail
 *             properties:
 *               newOwnerEmail:
 *                 type: string
 *                 format: email
 *                 description: Email of the new owner (must be active team member)
 *     responses:
 *       200:
 *         description: Ownership transferred successfully
 *       400:
 *         description: Bad request (new owner not a team member, etc.)
 *       403:
 *         description: Not a team owner
 */
router.post(
    '/transfer-ownership',
    isAuthenticated,
    validate(validateTransferOwnershipSchema),
    teamController.transferOwnership
);

/**
 * @swagger
 * /team/subscription:
 *   get:
 *     summary: Get team subscription details
 *     description: Get details of the team subscription (owner only)
 *     tags:
 *       - Team
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Team subscription details
 *       403:
 *         description: Not a team owner
 */
router.get(
    '/subscription',
    isAuthenticated,
    teamController.getTeamSubscriptionDetails
);

export default router;