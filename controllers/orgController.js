import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, AuthenticationError, AuthorizationError, ValidationError } from '../middleware/errorHandler.js';
import { ObjectId } from 'mongodb';
import { APPLICATION_STATUS } from '../utils/constants.js';
import { createNotification } from '../models/Notification.js';
import { buildOrgProfileUpdate } from '../utils/profileFields.js';

/**
 * Builds a query that matches by both ObjectId _id and custom orgId field.
 */
const buildIdQuery = (id) => {
  const query = { $or: [{ orgId: id }] };
  try {
    query.$or.push({ _id: new ObjectId(id) });
  } catch (e) {
    // id is not a valid ObjectId
  }
  return query;
};

export const getProfile = async (req, res, next) => {
  try {
    const db = getDb();
    const query = buildIdQuery(req.params.id);
    const org = await db.collection('organizations').findOne(query);
    if (!org) throw new NotFoundError('Organization not found');
    
    delete org.passwordHash;
    res.status(200).json({ success: true, data: org });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const db = getDb();
    const query = buildIdQuery(req.params.id);
    const org = await db.collection('organizations').findOne(query);
    if (!org) throw new NotFoundError('Organization not found');

    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin';
    const isAuthorized = req.user.id === org._id.toString() ||
                         req.user.id === org.orgId ||
                         req.user.id === req.params.id ||
                         isAdmin;
    if (!isAuthorized) throw new AuthenticationError('Not authorized');
    
    // Whitelist-only: only fields explicitly listed in profileFields.js are
    // ever copied out of req.body — passwordHash/orgId/role/userType/email
    // can never reach the update regardless of what the client sends.
    const updateData = { ...buildOrgProfileUpdate(req.body), updatedAt: new Date() };

    // Verification status is admin-only (see adminController.verifyOrganization) —
    // an organization must never be able to self-verify via a profile update.
    if (isAdmin) {
      for (const field of ['isVerified', 'verifiedAt', 'verificationNotes']) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updateData[field] = req.body[field];
        }
      }
    }

    // MongoDB v6: returns the document directly
    const updatedOrg = await db.collection('organizations').findOneAndUpdate(
      query,
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!updatedOrg) throw new NotFoundError('Organization not found');
    
    delete updatedOrg.passwordHash;
    
    res.status(200).json({ success: true, data: updatedOrg });
  } catch (error) {
    next(error);
  }
};

export const getApplications = async (req, res, next) => {
  try {
    const db = getDb();
    const paramId = req.params.id;
    const org = await db.collection('organizations').findOne(buildIdQuery(paramId));
    if (!org) throw new NotFoundError('Organization not found');

    const isAuthorized = req.user.id === org._id.toString() ||
                         req.user.id === org.orgId ||
                         req.user.id === paramId ||
                         req.user.role === 'admin' ||
                         req.user.userType === 'admin';
    if (!isAuthorized) throw new AuthenticationError('Not authorized');

    const orgIdStr = org._id.toString();
    const orgUUID = org.orgId ? org.orgId.toString() : orgIdStr;
    const orConditions = [
      { orgId: orgIdStr },
      { orgId: orgUUID },
      { orgId: org._id },
      { orgId: paramId }
    ];

    const applications = await db.collection('applications').find({ $or: orConditions }).toArray();
    res.status(200).json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
};

export const updateApplicationStatus = async (req, res, next) => {
  try {
    const db = getDb();
    const { status } = req.body;

    if (!status) throw new ValidationError('Status is required');

    // Find application by both ID schemes
    const appQuery = { $or: [{ applicationId: req.params.id }] };
    try {
      appQuery.$or.push({ _id: new ObjectId(req.params.id) });
    } catch (e) { /* not valid ObjectId */ }

    const application = await db.collection('applications').findOne(appQuery);
    if (!application) throw new NotFoundError('Application not found');

    // Authorization: org that owns the listing or admin can update
    const appOrgId = application.orgId?.toString();
    const isOwnerOrg = appOrgId === req.user.id || req.user.role === 'admin' || req.user.userType === 'admin';
    if (!isOwnerOrg) {
      const org = await db.collection('organizations').findOne(buildIdQuery(req.user.id));
      if (!org || (appOrgId !== org._id.toString() && appOrgId !== org.orgId)) {
        throw new AuthenticationError('Not authorized');
      }
    }

    // MongoDB v6: returns document directly
    const updatedApp = await db.collection('applications').findOneAndUpdate(
      appQuery,
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    // Notify athlete about application update
    if (application.athleteId) {
      await createNotification({
        userId: application.athleteId.toString(),
        title: `Application Status Updated: ${status}`,
        message: `Your application status has been updated to "${status}".`,
        type: 'APPLICATION_UPDATE',
        data: { applicationId: req.params.id, status }
      });
    }
    
    res.status(200).json({ success: true, data: updatedApp });
  } catch (error) {
    next(error);
  }
};

export const verifyAchievement = async (req, res, next) => {
  try {
    const db = getDb();
    const { athleteId, achId } = req.params;
    const { status = 'VERIFIED', notes = '' } = req.body;

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      throw new ValidationError('Status must be either VERIFIED or REJECTED');
    }

    const orgId = req.user.id;
    const org = await db.collection('organizations').findOne(buildIdQuery(orgId));
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin';

    // Only verified organizations or platform admins can verify athlete achievements
    if (!isAdmin && (!org || !org.isVerified)) {
      throw new AuthorizationError('Only officially verified organizations or platform admins can verify athlete achievements');
    }

    const athleteQuery = {
      $or: [{ athleteId: athleteId }]
    };
    try {
      athleteQuery.$or.push({ _id: new ObjectId(athleteId) });
    } catch (e) {}

    const athlete = await db.collection('athletes').findOne(athleteQuery);
    if (!athlete) throw new NotFoundError('Athlete not found');

    const orgName = org ? org.name : 'Platform Admin';

    let achObjectId = null;
    try { achObjectId = new ObjectId(achId); } catch (e) {}

    let updatedAchievement = null;
    const updatedAchievements = (athlete.achievements || []).map(ach => {
      const isMatch = (ach._id && achObjectId && ach._id.equals(achObjectId)) ||
                      (ach.achievementId && ach.achievementId === achId) ||
                      (ach._id && ach._id.toString() === achId);
      if (isMatch) {
        ach.verificationStatus = status;
        ach.verifiedBy = orgId;
        ach.verifiedByName = orgName;
        ach.verifiedAt = new Date();
        ach.verificationNotes = notes;
        updatedAchievement = ach;
      }
      return ach;
    });

    if (!updatedAchievement) {
      throw new NotFoundError('Achievement not found for this athlete');
    }

    const hasAnyVerified = updatedAchievements.some(a => a.verificationStatus === 'VERIFIED');

    await db.collection('athletes').updateOne(
      athleteQuery,
      {
        $set: {
          achievements: updatedAchievements,
          isVerified: hasAnyVerified,
          updatedAt: new Date()
        }
      }
    );

    // Notify the athlete
    await createNotification({
      userId: athlete._id.toString(),
      title: status === 'VERIFIED' ? '🏆 Achievement Verified!' : '⚠️ Achievement Verification Update',
      message: status === 'VERIFIED'
        ? `Your achievement "${updatedAchievement.title}" was verified by ${orgName}.`
        : `Your achievement "${updatedAchievement.title}" verification was rejected. Reason: ${notes || 'Criteria not met.'}`,
      type: 'ACHIEVEMENT_VERIFIED',
      data: {
        achievementId: achId,
        status,
        orgId,
        orgName
      }
    });

    res.status(200).json({
      success: true,
      message: `Achievement ${status.toLowerCase()} successfully`,
      data: updatedAchievement
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reverse Matching: Organization searches and filters athletes by sport, age, location, and criteria.
 */
export const searchAthletes = async (req, res, next) => {
  try {
    const { sport, minAge, maxAge, state, requiredLevel, minPerformance } = { ...req.query, ...req.body };
    const { searchMatchingAthletes } = await import('../services/matchingService.js');
    const results = await searchMatchingAthletes({ sport, minAge, maxAge, state, requiredLevel, minPerformance });

    res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 16 Master Spec: Organization Analytics Dashboard
 */
export const getOrgAnalytics = async (req, res, next) => {
  try {
    const db = getDb();
    const orgId = req.params.id || req.user.id;
    const orgIdQuery = { $or: [{ orgId: orgId }, { postedBy: orgId }] };
    try { orgIdQuery.$or.push({ orgId: new ObjectId(orgId) }); } catch (e) {}

    const [opportunitiesCount, jobsCount, sponsorshipsCount, applications] = await Promise.all([
      db.collection('opportunities').countDocuments(orgIdQuery),
      db.collection('jobs').countDocuments(orgIdQuery),
      db.collection('sponsorships').countDocuments(orgIdQuery),
      db.collection('applications').find({
        $or: [
          { orgId: orgId },
          ...(orgId.length === 24 ? [{ orgId: new ObjectId(orgId) }] : [])
        ]
      }).toArray()
    ]);

    const totalApplicants = applications.length;
    const shortlistedCount = applications.filter(a => a.status === 'Shortlisted').length;
    const selectedCount = applications.filter(a => a.status === 'Selected').length;
    const pendingCount = applications.filter(a => a.status === 'Pending' || a.status === 'Applied').length;

    res.status(200).json({
      success: true,
      data: {
        totalListings: opportunitiesCount + jobsCount + sponsorshipsCount,
        breakdown: {
          opportunities: opportunitiesCount,
          jobs: jobsCount,
          sponsorships: sponsorshipsCount
        },
        applicantStats: {
          totalApplicants,
          shortlisted: shortlistedCount,
          selected: selectedCount,
          pending: pendingCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};


