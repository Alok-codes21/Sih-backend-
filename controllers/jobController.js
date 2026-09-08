import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ConflictError } from '../middleware/errorHandler.js';
import { matchJobs } from '../services/matchingService.js';
import { ObjectId } from 'mongodb';

const safeObjectId = (id) => {
  try { return new ObjectId(id); } catch { return null; }
};

export const create = async (req, res, next) => {
  try {
    const db = getDb();
    const orgIdStr = req.user.id.toString();
    const orgOid = safeObjectId(req.user.id);
    const jobId = crypto.randomUUID();

    if (req.body.deadline && new Date(req.body.deadline) <= new Date()) {
      return res.status(400).json({ error: 'Deadline must be a future date' });
    }
    
    const newJob = {
      jobId,
      title: req.body.title,
      sport: req.body.sport,
      type: req.body.type,
      description: req.body.description || '',
      salary: req.body.salary || {},
      eligibility: req.body.eligibility || {},
      location: req.body.location || '',
      remote: req.body.remote || false,
      deadline: req.body.deadline ? new Date(req.body.deadline) : null,
      orgId: orgIdStr,
      postedBy: orgIdStr,
      ...(orgOid ? { orgObjectId: orgOid } : {}),
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('jobs').insertOne(newJob);
    res.status(201).json({ success: true, data: { _id: result.insertedId, ...newJob } });
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
    
    const [jobs, total] = await Promise.all([
      db.collection('jobs').find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('jobs').countDocuments(filters)
    ]);
    res.status(200).json({ success: true, count: jobs.length, total, page, limit, data: jobs });
  } catch (error) {
    next(error);
  }
};

export const getMatched = async (req, res, next) => {
  try {
    const athleteId = safeObjectId(req.user.id) || req.user.id;
    const matches = await matchJobs(athleteId);
    res.status(200).json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const db = getDb();
    const query = { $or: [{ jobId: req.params.id }] };
    const oid = safeObjectId(req.params.id);
    if (oid) query.$or.push({ _id: oid });

    const job = await db.collection('jobs').findOne(query);
    if (!job) throw new NotFoundError('Job not found');
    res.status(200).json({ success: true, data: job });
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
    
    const listingQuery = { $or: [{ jobId: listingParamId }] };
    if (lid) listingQuery.$or.push({ _id: lid });

    const job = await db.collection('jobs').findOne(listingQuery);
    if (!job) throw new NotFoundError('Job not found');

    const now = new Date();
    if (!['Active', 'active'].includes(String(job.status)) || (job.deadline && new Date(job.deadline) <= now)) {
      throw new ConflictError('This job is no longer accepting applications');
    }
    
    const jobIdStr = (job.jobId || job._id).toString();
    const jobOid = job._id;

    // Check for duplicate application across both string and ObjectId formats
    const athleteConditions = [
      { athleteId: athleteIdStr },
      ...(athleteOid ? [{ athleteId: athleteOid }] : [])
    ];
    const listingConditions = [
      { listingId: jobOid },
      { listingId: jobOid.toString() },
      { targetId: jobIdStr },
      { targetId: listingParamId }
    ];

    const existing = await db.collection('applications').findOne({
      $and: [
        { $or: athleteConditions },
        { $or: listingConditions }
      ]
    });
    if (existing) throw new ConflictError('Already applied to this job');
    
    const applicationId = crypto.randomUUID();
    const application = {
      applicationId,
      dedupeKey: `${athleteIdStr}:${jobIdStr}:Job`,
      athleteId: athleteIdStr,
      ...(athleteOid ? { athleteOid } : {}),
      listingId: jobOid,
      targetId: jobIdStr,
      orgId: (job.orgId || job.postedBy || '').toString(),
      type: 'job',
      targetType: 'Job',
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
