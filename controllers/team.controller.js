/**
 * @file controllers/team.controller.js
 * @description Controller for team subscription management operations.
 */
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { HttpStatusCode, AppMessages, PlanTypes, TeamLimits, TeamMemberStatus } from '../constants/index.js';
import { stripe } from '../config/stripe.js';
import { User } from '../models/user.model.js';
import { Plan } from '../models/plan.model.js';
import { TeamSubscription } from '../models/teamSubscription.model.js';
import { TeamMember } from '../models/teamMember.model.js';
import { bridge } from '../bridge.js';
import mongoose from 'mongoose';

/**
 * Helper: Calculate days between two dates
 */
function calculateDaysBetween(startDate, endDate) {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Helper: Add days to a date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * @async
 * @function createTeamCheckoutSession
 * @route POST /api/v1/team/create-checkout
 * @description Creates a Stripe Checkout Session for Small Business team subscription
 * @body {string} planId - The MongoDB _id of the Small Business plan
 * @body {number} seats - Number of seats to purchase (1-20)
 */
const createTeamCheckoutSession = asyncHandler(async (req, res) => {
  const { planId, seats } = req.body;
  const userId = req.user._id;

  // Validation
  if (!planId || !seats) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Plan ID and seats are required.');
  }
  if (seats < TeamLimits.MIN_SEATS || seats > TeamLimits.MAX_SEATS) {
    throw new ApiError(
      HttpStatusCode.BAD_REQUEST,
      `Seats must be between ${TeamLimits.MIN_SEATS} and ${TeamLimits.MAX_SEATS}.`
    );
  }

  // Check if user already owns a team
  if (req.user.isTeamOwner && req.user.ownedTeamSubscription) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'You already own a team subscription.');
  }

  // Verify plan
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive || plan.type !== PlanTypes.SMALL_BUSINESS) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Invalid Small Business plan selected.');
  }

  // Get or create Stripe customer
  let stripeCustomerId = req.user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      name: req.user.name,
      metadata: { userId: userId.toString() },
    });
    stripeCustomerId = customer.id;
  }

  // Fix URL configuration - use consistent bridge.FRONTEND_URL
  const frontendUrl = bridge.FRONTEND_URL;
  
  // Ensure the URL has proper scheme
  let processedFrontendUrl = frontendUrl;
  if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
    processedFrontendUrl = `https://${frontendUrl}`;
  }
  
  const successUrl = `${processedFrontendUrl}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${processedFrontendUrl}/dashboard?payment=canceled`;

  // Calculate the total amount for display purposes
  const totalAmount = plan.price * seats; // price is in cents

  try {
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [{
        price: plan.stripePriceId,
        quantity: seats, // This is what multiplies the base price
      }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId.toString(),
        planId: plan._id.toString(),
        planType: PlanTypes.SMALL_BUSINESS,
        seats: seats.toString(),
        paymentPurpose: 'team_subscription',
      },
      subscription_data: {
        metadata: {
          userId: userId.toString(),
          seats: seats.toString(),
        },
      },
      allow_promotion_codes: true,
    });

    // Update user's Stripe customer ID if new
    if (!req.user.stripeCustomerId) {
      req.user.stripeCustomerId = stripeCustomerId;
      await req.user.save({ validateBeforeSave: false });
    }

    return res.status(HttpStatusCode.OK).json(new ApiResponse(
      HttpStatusCode.OK,
      { 
        sessionId: session.id, 
        url: session.url,
        totalAmount: totalAmount,
        seats: seats,
        basePrice: plan.price
      },
      'Team checkout session created successfully.'
    ));
  } catch (error) {
    console.error("Error creating team checkout session:", error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      throw new ApiError(HttpStatusCode.BAD_REQUEST, `Payment error: ${error.message}`);
    } else if (error.type === 'StripeInvalidRequestError') {
      throw new ApiError(HttpStatusCode.BAD_REQUEST, `Invalid request: ${error.message}`);
    }
    
    throw new ApiError(
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to create checkout session.'
    );
  }
});

/**
 * @async
 * @function addTeamMember
 * @route POST /api/v1/team/members/add
 * @description Add a team member to the team subscription
 * @body {string} memberEmail - Email of the user to add
 */
const addTeamMember = asyncHandler(async (req, res) => {
  const { memberEmail } = req.body;
  const ownerId = req.user._id;

  if (!memberEmail) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Member email is required.');
  }

  // Verify owner has a team subscription
  if (!req.user.isTeamOwner || !req.user.ownedTeamSubscription) {
    throw new ApiError(HttpStatusCode.FORBIDDEN, 'You do not own a team subscription.');
  }

  const teamSub = await TeamSubscription.findById(req.user.ownedTeamSubscription).populate('planId');
  if (!teamSub || teamSub.subscriptionStatus !== 'active') {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Your team subscription is not active.');
  }

  // Check available seats (owner already occupies 1 seat)
  if (teamSub.usedSeats >= teamSub.totalSeats) {
    throw new ApiError(
      HttpStatusCode.BAD_REQUEST,
      `No available seats. You have ${teamSub.totalSeats} total seats (including yourself) and all are occupied. Currently used: ${teamSub.usedSeats}/${teamSub.totalSeats}.`
    );
  }

  // Find user to add
  const memberUser = await User.findOne({ email: memberEmail.toLowerCase() });
  if (!memberUser) {
    throw new ApiError(HttpStatusCode.NOT_FOUND, 'User with this email not found. User must register first.');
  }

  // Prevent owner from adding themselves
  if (memberUser._id.equals(ownerId)) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'You cannot add yourself as a team member.');
  }

  // Check if already a member
  const existingMembership = await TeamMember.findOne({
    teamSubscriptionId: teamSub._id,
    userId: memberUser._id,
    status: 'active',
  });

  if (existingMembership) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'User is already a member of your team.');
  }

  // Start transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let transitionDetails = {};
    let extendedExpiryDate = null;

    // Handle personal subscription transition
    if (memberUser.subscriptionStatus === 'active' && memberUser.stripeSubscriptionId) {
      const now = new Date();
      const personalExpiry = memberUser.subscriptionExpiresAt;

      if (personalExpiry > now) {
        // Calculate remaining days
        const remainingDays = calculateDaysBetween(now, personalExpiry);

        // Add remaining days to team subscription end
        extendedExpiryDate = addDays(teamSub.currentPeriodEnd, remainingDays);

        transitionDetails = {
          previousPlanId: memberUser.currentPlanId,
          previousStripeSubscriptionId: memberUser.stripeSubscriptionId,
          daysAddedToTeamEnd: remainingDays,
          personalPlanCanceledAt: now,
        };

        // Cancel personal Stripe subscription (cancel at period end = false, immediate cancel)
        try {
          await stripe.subscriptions.update(memberUser.stripeSubscriptionId, {
            cancel_at_period_end: false, // Immediate cancellation
          });
          await stripe.subscriptions.cancel(memberUser.stripeSubscriptionId);
          console.log(`Canceled personal subscription ${memberUser.stripeSubscriptionId} for user ${memberUser.email}`);
        } catch (stripeError) {
          console.error('Error canceling personal subscription:', stripeError);
          // Continue anyway - webhook will handle this
        }

        // Update member user
        memberUser.stripeSubscriptionId = null;
        memberUser.subscriptionStatus = 'canceled';
        memberUser.currentPlanId = null;
        memberUser.currentPlanType = null;
        memberUser.personalPlanCanceledForTeam = true;
        memberUser.extendedExpiryFromPersonalPlan = extendedExpiryDate;
      }
    }

    // Create team member record
    const teamMember = new TeamMember({
      teamSubscriptionId: teamSub._id,
      userId: memberUser._id,
      memberEmail: memberEmail.toLowerCase(),
      status: 'active',
      addedAt: new Date(),
      transitionDetails: Object.keys(transitionDetails).length > 0 ? transitionDetails : undefined,
    });
    await teamMember.save({ session });

    // Update member user
    memberUser.isTeamMember = true;
    memberUser.teamMembership = teamMember._id;
    await memberUser.save({ session, validateBeforeSave: false });

    // Update team subscription used seats
    teamSub.usedSeats += 1;
    await teamSub.save({ session });

    await session.commitTransaction();

    return res.status(HttpStatusCode.OK).json(new ApiResponse(
      HttpStatusCode.OK,
      {
        teamMember: {
          id: teamMember._id,
          email: teamMember.memberEmail,
          addedAt: teamMember.addedAt,
          extendedExpiry: extendedExpiryDate,
        },
        usedSeats: teamSub.usedSeats,
        totalSeats: teamSub.totalSeats,
      },
      'Team member added successfully.'
    ));
  } catch (error) {
    await session.abortTransaction();
    console.error('Error adding team member:', error);
    throw new ApiError(
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to add team member.'
    );
  } finally {
    session.endSession();
  }
});

/**
 * @async
 * @function removeTeamMember
 * @route POST /api/v1/team/members/remove
 * @description Remove a team member (access remains until period end)
 * @body {string} memberId - TeamMember document ID to remove
 */
const removeTeamMember = asyncHandler(async (req, res) => {
  const { memberId } = req.body;
  const ownerId = req.user._id;

  if (!memberId) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Member ID is required.');
  }

  // Verify ownership
  if (!req.user.isTeamOwner || !req.user.ownedTeamSubscription) {
    throw new ApiError(HttpStatusCode.FORBIDDEN, 'You do not own a team subscription.');
  }

  const teamSub = await TeamSubscription.findById(req.user.ownedTeamSubscription);
  if (!teamSub) {
    throw new ApiError(HttpStatusCode.NOT_FOUND, 'Team subscription not found.');
  }

  // Find team member
  const teamMember = await TeamMember.findOne({
    _id: memberId,
    teamSubscriptionId: teamSub._id,
    status: 'active',
  }).populate('userId');

  if (!teamMember) {
    throw new ApiError(HttpStatusCode.NOT_FOUND, 'Team member not found or already removed.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Mark as removed but access remains until period end
    teamMember.status = 'pending_removal';
    teamMember.removedAt = new Date();
    teamMember.accessExpiresAt = teamSub.currentPeriodEnd;
    await teamMember.save({ session });

    // Note: usedSeats will be decremented at next renewal or when access actually expires
    // For now, keep the seat "used" since member still has access
    await session.commitTransaction();

    return res.status(HttpStatusCode.OK).json(new ApiResponse(
      HttpStatusCode.OK,
      {
        memberId: teamMember._id,
        memberEmail: teamMember.memberEmail,
        accessExpiresAt: teamMember.accessExpiresAt,
      },
      'Team member removed. Access remains until end of current billing period.'
    ));
  } catch (error) {
    await session.abortTransaction();
    console.error('Error removing team member:', error);
    throw new ApiError(
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to remove team member.'
    );
  } finally {
    session.endSession();
  }
});

/**
 * @async
 * @function getTeamMembers
 * @route GET /api/v1/team/members
 * @description Get all team members for the owner's team
 */
const getTeamMembers = asyncHandler(async (req, res) => {
  if (!req.user.isTeamOwner || !req.user.ownedTeamSubscription) {
    throw new ApiError(HttpStatusCode.FORBIDDEN, 'You do not own a team subscription.');
  }

  const members = await TeamMember.find({
    teamSubscriptionId: req.user.ownedTeamSubscription,
  })
  .populate('userId', 'name email avatar')
  .sort({ addedAt: -1 });

  const teamSub = await TeamSubscription.findById(req.user.ownedTeamSubscription);

  return res.status(HttpStatusCode.OK).json(new ApiResponse(
    HttpStatusCode.OK,
    {
      members,
      usedSeats: teamSub.usedSeats,
      totalSeats: teamSub.totalSeats,
      availableSeats: teamSub.totalSeats - teamSub.usedSeats,
      note: 'You (owner) occupy 1 seat. Used seats includes you + team members.'
    },
    'Team members fetched successfully.'
  ));
});

/**
 * @async
 * @function transferOwnership
 * @route POST /api/v1/team/transfer-ownership
 * @description Transfer team ownership to another team member
 * @body {string} newOwnerEmail - Email of the new owner (must be existing team member)
 */
const transferOwnership = asyncHandler(async (req, res) => {
  const { newOwnerEmail } = req.body;
  const currentOwnerId = req.user._id;

  if (!newOwnerEmail) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'New owner email is required.');
  }

  // Verify current ownership
  if (!req.user.isTeamOwner || !req.user.ownedTeamSubscription) {
    throw new ApiError(HttpStatusCode.FORBIDDEN, 'You do not own a team subscription.');
  }

  const teamSub = await TeamSubscription.findById(req.user.ownedTeamSubscription);
  if (!teamSub || teamSub.subscriptionStatus !== 'active') {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Your team subscription is not active.');
  }

  // Find new owner
  const newOwner = await User.findOne({ email: newOwnerEmail.toLowerCase() });
  if (!newOwner) {
    throw new ApiError(HttpStatusCode.NOT_FOUND, 'New owner user not found.');
  }

  if (newOwner._id.equals(currentOwnerId)) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'You are already the owner.');
  }

  // Verify new owner is a team member
  const newOwnerMembership = await TeamMember.findOne({
    teamSubscriptionId: teamSub._id,
    userId: newOwner._id,
    status: 'active',
  });

  if (!newOwnerMembership) {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'New owner must be an active team member.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update Stripe subscription customer
    await stripe.subscriptions.update(teamSub.stripeSubscriptionId, {
      cancel_at_period_end: true, // Cancel auto-renewal for old owner
    });

    // Create new Stripe customer for new owner if needed
    let newOwnerStripeCustomerId = newOwner.stripeCustomerId;
    if (!newOwnerStripeCustomerId) {
      const customer = await stripe.customers.create({
        email: newOwner.email,
        name: newOwner.name,
        metadata: { userId: newOwner._id.toString() },
      });
      newOwnerStripeCustomerId = customer.id;
      newOwner.stripeCustomerId = newOwnerStripeCustomerId;
    }

    // Transfer subscription to new customer
    await stripe.subscriptions.update(teamSub.stripeSubscriptionId, {
      customer: newOwnerStripeCustomerId,
      cancel_at_period_end: false, // Re-enable auto-renewal for new owner
    });

    // Update team subscription
    teamSub.ownerId = newOwner._id;
    await teamSub.save({ session });

    // Update old owner - convert to team member
    const oldOwnerAsMember = new TeamMember({
      teamSubscriptionId: teamSub._id,
      userId: currentOwnerId,
      memberEmail: req.user.email,
      status: 'active',
      addedAt: new Date(),
    });
    await oldOwnerAsMember.save({ session });

    req.user.isTeamOwner = false;
    req.user.ownedTeamSubscription = null;
    req.user.isTeamMember = true;
    req.user.teamMembership = oldOwnerAsMember._id;
    await req.user.save({ session, validateBeforeSave: false });

    // Update new owner - remove from members, make owner
    await TeamMember.findByIdAndDelete(newOwnerMembership._id, { session });
    newOwner.isTeamMember = false;
    newOwner.teamMembership = null;
    newOwner.isTeamOwner = true;
    newOwner.ownedTeamSubscription = teamSub._id;
    await newOwner.save({ session, validateBeforeSave: false });

    await session.commitTransaction();

    return res.status(HttpStatusCode.OK).json(new ApiResponse(
      HttpStatusCode.OK,
      {
        newOwnerEmail: newOwner.email,
        transferredAt: new Date(),
      },
      'Ownership transferred successfully.'
    ));
  } catch (error) {
    await session.abortTransaction();
    console.error('Error transferring ownership:', error);
    throw new ApiError(
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to transfer ownership.'
    );
  } finally {
    session.endSession();
  }
});

/**
 * @async
 * @function getTeamSubscriptionDetails
 * @route GET /api/v1/team/subscription
 * @description Get team subscription details for owner
 */
const getTeamSubscriptionDetails = asyncHandler(async (req, res) => {
  if (!req.user.isTeamOwner || !req.user.ownedTeamSubscription) {
    throw new ApiError(HttpStatusCode.FORBIDDEN, 'You do not own a team subscription.');
  }

  const teamSub = await TeamSubscription.findById(req.user.ownedTeamSubscription)
    .populate('planId');

  if (!teamSub) {
    throw new ApiError(HttpStatusCode.NOT_FOUND, 'Team subscription not found.');
  }

  return res.status(HttpStatusCode.OK).json(new ApiResponse(
    HttpStatusCode.OK,
    {
      subscription: teamSub,
      members: teamSub.usedSeats,
      availableSeats: teamSub.totalSeats - teamSub.usedSeats,
    },
    'Team subscription details fetched successfully.'
  ));
});

export const teamController = {
  createTeamCheckoutSession,
  addTeamMember,
  removeTeamMember,
  getTeamMembers,
  transferOwnership,
  getTeamSubscriptionDetails,
};