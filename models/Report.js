import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const getReportsCollection = () => {
  return getDb().collection('reports');
};

/**
 * Creates a report against a user, listing, or application.
 */
export const createReport = async ({ reporterId, reporterRole = 'athlete', targetType, targetId, reason, description = '' }) => {
  try {
    const reportId = crypto.randomUUID();
    const newReport = {
      reportId,
      reporterId: reporterId.toString(),
      reporterRole,
      targetType, // 'opportunity' | 'job' | 'sponsorship' | 'user' | 'application'
      targetId: targetId.toString(),
      reason, // 'Spam' | 'Fraud' | 'Inappropriate Content' | 'Harassment' | 'Other'
      description,
      status: 'PENDING', // 'PENDING' | 'RESOLVED' | 'DISMISSED'
      actionTaken: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await getReportsCollection().insertOne(newReport);
    logger.info(`Abuse report filed: ${reportId} for target ${targetId}`);
    return { ...newReport, _id: result.insertedId };
  } catch (error) {
    logger.error('Error creating abuse report', { error: error.message });
    throw error;
  }
};

/**
 * Gets all reports with optional status filtering.
 */
export const getAllReports = async ({ status, limit = 50, skip = 0 } = {}) => {
  try {
    const query = {};
    if (status) query.status = status;

    return await getReportsCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  } catch (error) {
    logger.error('Error fetching reports', { error: error.message });
    throw error;
  }
};

/**
 * Resolves or dismisses a report.
 */
export const moderateReport = async (reportId, { status, actionTaken, adminId }) => {
  try {
    const query = { $or: [{ reportId }] };
    try { query.$or.push({ _id: new ObjectId(reportId) }); } catch (e) {}

    const result = await getReportsCollection().findOneAndUpdate(
      query,
      {
        $set: {
          status,
          actionTaken: actionTaken || 'None',
          reviewedBy: adminId ? adminId.toString() : 'admin',
          reviewedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result;
  } catch (error) {
    logger.error('Error moderating report', { error: error.message });
    throw error;
  }
};
