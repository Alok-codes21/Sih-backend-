import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { matchOpportunities } from '../services/matchingService.js';
import { ObjectId } from 'mongodb';

/**
 * Safely creates an ObjectId from a string, returning null on failure.
 */
const safeObjectId = (id) => {
  try { return new ObjectId(id); } catch { return null; }
};

export const create = async (req, res, next) => {
  try {
    const db = getDb();
    const orgIdStr = req.user.id.toString();
    const orgOid = safeObjectId(req.user.id);
    const oppId = crypto.randomUUID();

    // Validate deadline is in the future
    if (req.body.deadline && new Date(req.body.deadline) <= new Date()) {
      return res.status(400).json({ error: 'Deadline must be a future date' });
    }
    
    // Whitelist allowed fields to prevent field injection
    const newOpportunity = {
      oppId,
      title: req.body.title,
      type: req.body.type,
      sport: req.body.sport,
      description: req.body.description || '',
      eligibility: req.body.eligibility || {},
      deadline: req.body.deadline ? new Date(req.body.deadline) : null,
      location: req.body.location || '',
      monetaryBenefit: req.body.monetaryBenefit || null,
      orgId: orgIdStr,
      postedBy: orgIdStr,
      ...(orgOid ? { orgObjectId: orgOid } : {}),
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('opportunities').insertOne(newOpportunity);
    res.status(201).json({ success: true, data: { _id: result.insertedId, ...newOpportunity } });
  } catch (error) {
    next(error);
  }
};

export const getAll = async (req, res, next) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const filters = {
      $and: [
        { $or: [{ status: 'Active' }, { status: 'active' }] },
        { $or: [{ deadline: null }, { deadline: { $gt: new Date() } }] }
      ]
    };
    if (req.query.sport) filters.sport = req.query.sport;
    
    const [opportunities, total] = await Promise.all([
      db.collection('opportunities').find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('opportunities').countDocuments(filters)
    ]);
    res.status(200).json({ success: true, count: opportunities.length, total, page, limit, data: opportunities });
  } catch (error) {
    next(error);
  }
};

export const getMatched = async (req, res, next) => {
  try {
    const athleteId = safeObjectId(req.user.id) || req.user.id;
    const matches = await matchOpportunities(athleteId);
    res.status(200).json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const db = getDb();
    const query = { $or: [{ oppId: req.params.id }] };
    const oid = safeObjectId(req.params.id);
    if (oid) query.$or.push({ _id: oid });

    const opp = await db.collection('opportunities').findOne(query);
    if (!opp) throw new NotFoundError('Opportunity not found');
    res.status(200).json({ success: true, data: opp });
  } catch (error) {
    next(error);
  }
};

export const apply = async (req, res, next) => {
  try {
    const db = getDb();
    const athleteIdStr = req.user.id.toString();
    const athleteOid = safeObjectId(req.user.id);
    const listingParamId = req.params.id;
    const lid = safeObjectId(listingParamId);
    
    // Find listing by both ID schemes
    const listingQuery = { $or: [{ oppId: listingParamId }] };
    if (lid) listingQuery.$or.push({ _id: lid });

    const opp = await db.collection('opportunities').findOne(listingQuery);
    if (!opp) throw new NotFoundError('Opportunity not found');

    const now = new Date();
    if (!['Active', 'active'].includes(String(opp.status)) || (opp.deadline && new Date(opp.deadline) <= now)) {
      throw new ConflictError('This opportunity is no longer accepting applications');
    }

    const oppIdStr = (opp.oppId || opp._id).toString();
    const oppOid = opp._id;
    
    // Check for duplicate application across both string and ObjectId formats
    const athleteConditions = [
      { athleteId: athleteIdStr },
      ...(athleteOid ? [{ athleteId: athleteOid }] : [])
    ];
    const listingConditions = [
      { listingId: oppOid },
      { listingId: oppOid.toString() },
      { targetId: oppIdStr },
      { targetId: listingParamId }
    ];

    const existing = await db.collection('applications').findOne({
      $and: [
        { $or: athleteConditions },
        { $or: listingConditions }
      ]
    });
    if (existing) throw new ConflictError('Already applied to this opportunity');
    
    const applicationId = crypto.randomUUID();
    const application = {
      applicationId,
      dedupeKey: `${athleteIdStr}:${oppIdStr}:Opportunity`,
      athleteId: athleteIdStr,
      ...(athleteOid ? { athleteOid } : {}),
      listingId: oppOid,
      targetId: oppIdStr,
      orgId: (opp.orgId || opp.postedBy || '').toString(),
      type: 'opportunity',
      targetType: 'Opportunity',
      status: 'Applied',
      coverLetter: req.body.coverLetter || req.body.message || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('applications').insertOne(application);
    res.status(201).json({ success: true, data: { _id: result.insertedId, ...application } });
  } catch (error) {
    next(error);
  }
};
