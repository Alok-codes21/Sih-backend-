import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, AuthenticationError, ValidationError, ConflictError } from '../middleware/errorHandler.js';
import { createNotification } from '../models/Notification.js';
import { APPLICATION_STATUS } from '../utils/constants.js';

const safeObjectId = (id) => {
  try { return new ObjectId(id); } catch { return null; }
};

/**
 * Gets all applications submitted by the logged-in athlete.
 */
export const getMyApplications = async (req, res, next) => {
  try {
    const db = getDb();
    const athleteIdStr = req.user.id;
    const athleteOid = safeObjectId(athleteIdStr);

    const query = {
      $or: [
        { athleteId: athleteIdStr },
        ...(athleteOid ? [{ athleteId: athleteOid }] : [])
      ]
    };

    const applications = await db.collection('applications')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets a specific application by ID with resource ownership verification.
 */
export const getApplicationById = async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const appIdQuery = { $or: [{ applicationId: id }] };
    const oid = safeObjectId(id);
    if (oid) appIdQuery.$or.push({ _id: oid });

    const application = await db.collection('applications').findOne(appIdQuery);
    if (!application) throw new NotFoundError('Application not found');

    const userId = req.user.id;
    let isOwner = application.athleteId?.toString() === userId ||
                  (application.athleteOid && application.athleteOid.toString() === userId);
    let isOrg = application.orgId?.toString() === userId;
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin';

    if (!isOwner && !isOrg && !isAdmin) {
      // Check if athlete UUID or org UUID matches
      const userDoc = await db.collection('athletes').findOne({
        $or: [{ athleteId: userId }, ...(safeObjectId(userId) ? [{ _id: safeObjectId(userId) }] : [])]
      }) || await db.collection('organizations').findOne({
        $or: [{ orgId: userId }, ...(safeObjectId(userId) ? [{ _id: safeObjectId(userId) }] : [])]
      });

      if (userDoc) {
        if (userDoc.athleteId && (application.athleteId?.toString() === userDoc.athleteId || application.athleteId?.toString() === userDoc._id.toString())) {
          isOwner = true;
        }
        if (userDoc.orgId && (application.orgId?.toString() === userDoc.orgId || application.orgId?.toString() === userDoc._id.toString())) {
          isOrg = true;
        }
      }
    }

    if (!isOwner && !isOrg && !isAdmin) {
      throw new AuthenticationError('Not authorized to view this application');
    }

    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Athlete withdraws their application.
 */
export const withdrawApplication = async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const appIdQuery = { $or: [{ applicationId: id }] };
    const oid = safeObjectId(id);
    if (oid) appIdQuery.$or.push({ _id: oid });

    const application = await db.collection('applications').findOne(appIdQuery);
    if (!application) throw new NotFoundError('Application not found');

    const isAuthorized = application.athleteId?.toString() === req.user.id ||
                         (application.athleteOid && application.athleteOid.toString() === req.user.id);
    if (!isAuthorized && req.user.role !== 'admin') {
      throw new AuthenticationError('Not authorized to withdraw this application');
    }

    if (['Selected', 'Rejected', 'Withdrawn'].includes(application.status)) {
      throw new ValidationError(`Cannot withdraw application with status '${application.status}'`);
    }

    const updated = await db.collection('applications').findOneAndUpdate(
      appIdQuery,
      { $set: { status: 'Withdrawn', updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    res.status(200).json({
      success: true,
      message: 'Application withdrawn successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Organization updates application status.
 */
export const updateStatus = async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;

    if (!status) throw new ValidationError('Status is required');
    if (!Object.values(APPLICATION_STATUS).includes(status)) {
      throw new ValidationError(`Invalid application status. Allowed values: ${Object.values(APPLICATION_STATUS).join(', ')}`);
    }

    const appIdQuery = { $or: [{ applicationId: id }] };
    const oid = safeObjectId(id);
    if (oid) appIdQuery.$or.push({ _id: oid });

    const application = await db.collection('applications').findOne(appIdQuery);
    if (!application) throw new NotFoundError('Application not found');

    let isOrg = application.orgId?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.userType === 'admin';

    if (!isOrg && !isAdmin) {
      const org = await db.collection('organizations').findOne({
        $or: [{ orgId: req.user.id }, ...(safeObjectId(req.user.id) ? [{ _id: safeObjectId(req.user.id) }] : [])]
      });
      if (org && (application.orgId?.toString() === org._id.toString() || application.orgId?.toString() === org.orgId)) {
        isOrg = true;
      }
    }

    if (!isOrg && !isAdmin) {
      throw new AuthenticationError('Not authorized to update this application status');
    }

    const updated = await db.collection('applications').findOneAndUpdate(
      appIdQuery,
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (application.athleteId) {
      await createNotification({
        userId: application.athleteId.toString(),
        title: `Application Status: ${status}`,
        message: `Your application status has been updated to "${status}".`,
        type: 'APPLICATION_UPDATE',
        data: { applicationId: id, status }
      });
    }

    res.status(200).json({
      success: true,
      message: `Application status updated to ${status}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};
