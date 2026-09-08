import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, AuthenticationError, ValidationError } from '../middleware/errorHandler.js';
import { ObjectId } from 'mongodb';
import { recordAthleteStat, getAthleteStats } from '../models/AthleteStats.js';
import { buildAthleteProfileUpdate } from '../utils/profileFields.js';

/**
 * Attempts to build a MongoDB query that matches both ObjectId _id
 * and custom string UUID fields.
 */
const buildIdQuery = (id) => {
  const query = { $or: [{ athleteId: id }] };
  try {
    query.$or.push({ _id: new ObjectId(id) });
  } catch (e) {
    // id is not a valid ObjectId
  }
  return query;
};

/**
 * Section 23 Master Spec: Filters sensitive profile data according to athlete privacy settings.
 */
const applyPrivacyFilter = (athlete, requester) => {
  const safe = { ...athlete };
  delete safe.passwordHash;

  const isSelf = requester && (requester.id === safe._id.toString() || requester.id === safe.athleteId);
  const isAdmin = requester && (requester.userType === 'admin' || requester.role === 'admin');
  const isOrg = requester && (requester.userType === 'organization' || requester.role === 'organization');

  if (isSelf || isAdmin) {
    return safe;
  }

  const privacyLevel = safe.privacy?.profile || 'public';

  if (privacyLevel === 'private') {
    return {
      _id: safe._id,
      athleteId: safe.athleteId,
      name: safe.name || `${safe.firstName} ${safe.lastName}`,
      sport: safe.sport,
      primarySport: safe.primarySport,
      isVerified: safe.isVerified,
      privacyMessage: 'This profile is set to private.'
    };
  }

  if (privacyLevel === 'organizations_only' && !isOrg) {
    delete safe.contactInformation;
    delete safe.phone;
    delete safe.email;
    safe.privacyNotice = 'Contact information visible to verified organizations only.';
  }

  return safe;
};

export const getProfile = async (req, res, next) => {
  try {
    const db = getDb();
    const query = buildIdQuery(req.params.id);
    const athlete = await db.collection('athletes').findOne(query);
    if (!athlete) throw new NotFoundError('Athlete not found');
    
    const filtered = applyPrivacyFilter(athlete, req.user);
    res.status(200).json({ success: true, data: filtered });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 20 Master Spec: GET /api/athletes/profile
 * Returns the currently authenticated athlete's own profile.
 */
export const getMyProfile = async (req, res, next) => {
  try {
    const db = getDb();
    const query = buildIdQuery(req.user.id);
    const athlete = await db.collection('athletes').findOne(query);
    if (!athlete) throw new NotFoundError('Athlete profile not found');

    delete athlete.passwordHash;
    res.status(200).json({ success: true, data: athlete });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 20 Master Spec: PUT /api/athletes/profile
 * Updates the currently authenticated athlete's profile.
 */
export const updateMyProfile = async (req, res, next) => {
  try {
    const db = getDb();
    const query = buildIdQuery(req.user.id);

    const current = await db.collection('athletes').findOne(query);
    if (!current) throw new NotFoundError('Athlete profile not found');

    // Whitelist-only: only fields explicitly listed in profileFields.js are
    // ever copied out of req.body, so passwordHash/isVerified/achievements/
    // athleteId/role/etc. can never reach the update regardless of what the
    // client sends.
    const updateData = { ...buildAthleteProfileUpdate(req.body, current), updatedAt: new Date() };

    const updated = await db.collection('athletes').findOneAndUpdate(
      query,
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!updated) throw new NotFoundError('Athlete profile not found');
    delete updated.passwordHash;

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

const checkAthleteAuthorization = async (db, requester, targetId) => {
  if (!requester) return false;
  if (requester.role === 'admin' || requester.userType === 'admin') return true;
  if (requester.id === targetId || requester.athleteId === targetId) return true;
  const athlete = await db.collection('athletes').findOne(buildIdQuery(targetId));
  if (athlete && (athlete._id.toString() === requester.id || athlete.athleteId === requester.id || athlete.email === requester.email)) {
    return true;
  }
  return false;
};

export const updateProfile = async (req, res, next) => {
  try {
    const paramId = req.params.id;
    const db = getDb();

    const isAuthorized = await checkAthleteAuthorization(db, req.user, paramId);
    if (!isAuthorized) {
      throw new AuthenticationError('Not authorized to update this profile');
    }

    const query = buildIdQuery(paramId);
    const current = await db.collection('athletes').findOne(query);
    if (!current) throw new NotFoundError('Athlete not found');

    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin';

    // Whitelist-only base: ordinary profile fields, never identity/security fields.
    const updateData = { ...buildAthleteProfileUpdate(req.body, current), updatedAt: new Date() };

    // Verification/achievement fields remain admin-only, and are only copied
    // across explicitly when actually present in the request body.
    if (isAdmin) {
      for (const field of ['isVerified', 'achievements', 'verifiedBadge', 'verificationStatus']) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updateData[field] = req.body[field];
        }
      }
    }

    const updatedAthlete = await db.collection('athletes').findOneAndUpdate(
      query,
      { $set: updateData },
      { returnDocument: 'after' }
    );
    
    if (!updatedAthlete) throw new NotFoundError('Athlete not found');
    delete updatedAthlete.passwordHash;
    
    res.status(200).json({ success: true, data: updatedAthlete });
  } catch (error) {
    next(error);
  }
};

export const addAchievement = async (req, res, next) => {
  try {
    const targetId = req.params.id || req.user.id;
    const db = getDb();

    const isAuthorized = await checkAthleteAuthorization(db, req.user, targetId);
    if (!isAuthorized) throw new AuthenticationError('Not authorized');

    const query = buildIdQuery(targetId);
    const achievement = {
      _id: new ObjectId(),
      achievementId: crypto.randomUUID(),
      title: req.body.title,
      level: req.body.level || 'District',
      sport: req.body.sport || '',
      year: req.body.year || new Date().getFullYear(),
      certificateUrl: req.body.certificateUrl || req.body.certificate || null,
      verificationStatus: 'PENDING',
      verifiedBy: null,
      verifiedAt: null,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      addedAt: new Date()
    };
    
    const result = await db.collection('athletes').updateOne(
      query,
      { $push: { achievements: achievement }, $set: { updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) throw new NotFoundError('Athlete not found');
    
    res.status(201).json({ success: true, data: achievement });
  } catch (error) {
    next(error);
  }
};

export const removeAchievement = async (req, res, next) => {
  try {
    const targetId = req.params.id || req.user.id;
    const db = getDb();

    const isAuthorized = await checkAthleteAuthorization(db, req.user, targetId);
    if (!isAuthorized) throw new AuthenticationError('Not authorized');

    const query = buildIdQuery(targetId);

    const achIdStr = req.params.achId;
    let achObjectId = null;
    try { achObjectId = new ObjectId(achIdStr); } catch (e) {}

    const pullCondition = {
      $or: [
        ...(achObjectId ? [{ _id: achObjectId }] : []),
        { achievementId: achIdStr }
      ]
    };
    
    const result = await db.collection('athletes').updateOne(
      query,
      { $pull: { achievements: pullCondition }, $set: { updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) throw new NotFoundError('Athlete not found');
    
    res.status(200).json({ success: true, message: 'Achievement removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 2 & 19 Master Spec: Dynamic Sport-Specific Performance Stats
 */
export const addPerformanceStat = async (req, res, next) => {
  try {
    const targetId = req.params.id || req.user.id;
    const db = getDb();

    const isAuthorized = await checkAthleteAuthorization(db, req.user, targetId);
    if (!isAuthorized) throw new AuthenticationError('Not authorized');

    const sport = req.body.sport;
    const statName = req.body.statName || req.body.metricName;
    const statValue = req.body.statValue !== undefined ? req.body.statValue : req.body.value;
    const unit = req.body.unit || '';

    if (!sport || !statName || statValue === undefined) {
      throw new ValidationError('Sport, statName, and statValue are required');
    }

    const stat = await recordAthleteStat({
      athleteId: targetId,
      sport,
      statName,
      statValue,
      unit: unit || ''
    });

    res.status(201).json({
      success: true,
      message: `Performance stat '${statName}' recorded`,
      data: stat
    });
  } catch (error) {
    next(error);
  }
};

export const getPerformanceStats = async (req, res, next) => {
  try {
    const targetId = req.params.id || req.user.id;
    const { sport } = req.query;

    const stats = await getAthleteStats(targetId, sport);
    res.status(200).json({
      success: true,
      count: stats.length,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req, res, next) => {
  try {
    const targetId = req.params.id || req.user.id;
    const db = getDb();

    const isAuthorized = await checkAthleteAuthorization(db, req.user, targetId);
    if (!isAuthorized) throw new AuthenticationError('Not authorized');

    const query = buildIdQuery(targetId);
    
    const athlete = await db.collection('athletes').findOne(query);
    if (!athlete) throw new NotFoundError('Athlete not found');
    
    const totalApplications = await db.collection('applications').countDocuments({
      $or: [
        { athleteId: athlete._id.toString() },
        { athleteId: athlete._id },
        ...(athlete.athleteId ? [{ athleteId: athlete.athleteId }] : [])
      ]
    });

    let matchedOpportunitiesCount = 0;
    try {
      const { matchOpportunities } = await import('../services/matchingService.js');
      const matches = await matchOpportunities(athlete._id);
      matchedOpportunitiesCount = matches.filter(m => m.isEligible).length;
    } catch (matchErr) {
      logger.warn('Failed to compute exact matches for dashboard', { error: matchErr.message });
      matchedOpportunitiesCount = 0;
    }

    res.status(200).json({
      success: true,
      data: {
        totalApplications,
        matchedOpportunities: matchedOpportunitiesCount,
        achievementsCount: athlete.achievements ? athlete.achievements.length : 0
      }
    });
  } catch (error) {
    next(error);
  }
};

