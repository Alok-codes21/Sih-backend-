import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { matchSponsorships } from '../services/matchingService.js';
import { ObjectId } from 'mongodb';

const safeObjectId = (id) => {
  try { return new ObjectId(id); } catch { return null; }
};

export const create = async (req, res, next) => {
  try {
    const db = getDb();
    const orgIdStr = req.user.id.toString();
    const orgOid = safeObjectId(req.user.id);
    const sponsorId = crypto.randomUUID();

    if (req.body.deadline && new Date(req.body.deadline) <= new Date()) {
      return res.status(400).json({ error: 'Deadline must be a future date' });
    }
    
    const newSponsorship = {
      sponsorId,
      title: req.body.title,
      sport: req.body.sport,
      type: req.body.type,
      description: req.body.description || '',
      eligibility: req.body.eligibility || {},
      location: req.body.location || '',
      amount: req.body.amount || null,
      duration: req.body.duration || '',
      deadline: req.body.deadline ? new Date(req.body.deadline) : null,
      orgId: orgIdStr,
      postedBy: orgIdStr,
      ...(orgOid ? { orgObjectId: orgOid } : {}),
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('sponsorships').insertOne(newSponsorship);
    res.status(201).json({ success: true, data: { _id: result.insertedId, ...newSponsorship } });
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
    
    const [sponsorships, total] = await Promise.all([
      db.collection('sponsorships').find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('sponsorships').countDocuments(filters)
    ]);
    res.status(200).json({ success: true, count: sponsorships.length, total, page, limit, data: sponsorships });
  } catch (error) {
    next(error);
  }
};

export const getMatched = async (req, res, next) => {
  try {
    const athleteId = safeObjectId(req.user.id) || req.user.id;
    const matches = await matchSponsorships(athleteId);
    res.status(200).json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const db = getDb();
    const query = { $or: [{ sponsorId: req.params.id }] };
    const oid = safeObjectId(req.params.id);
    if (oid) query.$or.push({ _id: oid });

    const sponsorship = await db.collection('sponsorships').findOne(query);
    if (!sponsorship) throw new NotFoundError('Sponsorship not found');
    res.status(200).json({ success: true, data: sponsorship });
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
    
    const listingQuery = { $or: [{ sponsorId: listingParamId }] };
    if (lid) listingQuery.$or.push({ _id: lid });

    const sponsorship = await db.collection('sponsorships').findOne(listingQuery);
    if (!sponsorship) throw new NotFoundError('Sponsorship not found');

    const now = new Date();
    if (!['Active', 'active'].includes(String(sponsorship.status)) || (sponsorship.deadline && new Date(sponsorship.deadline) <= now)) {
      throw new ConflictError('This sponsorship is no longer accepting applications');
    }
    
    const sponsorIdStr = (sponsorship.sponsorId || sponsorship._id).toString();
    const sponsorOid = sponsorship._id;

    // Check for duplicate application across both string and ObjectId formats
    const athleteConditions = [
      { athleteId: athleteIdStr },
      ...(athleteOid ? [{ athleteId: athleteOid }] : [])
    ];
    const listingConditions = [
      { listingId: sponsorOid },
      { listingId: sponsorOid.toString() },
      { targetId: sponsorIdStr },
      { targetId: listingParamId }
    ];

    const existing = await db.collection('applications').findOne({
      $and: [
        { $or: athleteConditions },
        { $or: listingConditions }
      ]
    });
    if (existing) throw new ConflictError('Already applied to this sponsorship');
    
    const applicationId = crypto.randomUUID();
    const application = {
      applicationId,
      dedupeKey: `${athleteIdStr}:${sponsorIdStr}:Sponsorship`,
      athleteId: athleteIdStr,
      ...(athleteOid ? { athleteOid } : {}),
      listingId: sponsorOid,
      targetId: sponsorIdStr,
      orgId: (sponsorship.orgId || sponsorship.postedBy || '').toString(),
      type: 'sponsorship',
      targetType: 'Sponsorship',
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
