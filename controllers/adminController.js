import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { createNotification } from '../models/Notification.js';

/**
 * Builds a query matching both custom ID and ObjectId.
 */
const safeIdQuery = (id, fieldName) => {
  const query = { $or: [{ [fieldName]: id }] };
  try {
    query.$or.push({ _id: new ObjectId(id) });
  } catch (e) {}
  return query;
};

/**
 * Platform aggregated statistics for admin dashboard.
 */
export const getPlatformStats = async (req, res, next) => {
  try {
    const db = getDb();

    const [
      totalAthletes,
      verifiedAthletes,
      totalOrganizations,
      verifiedOrganizations,
      totalOpportunities,
      activeOpportunities,
      totalApplications,
      totalJobs,
      totalSponsorships
    ] = await Promise.all([
      db.collection('athletes').countDocuments(),
      db.collection('athletes').countDocuments({ isVerified: true }),
      db.collection('organizations').countDocuments(),
      db.collection('organizations').countDocuments({ isVerified: true }),
      db.collection('opportunities').countDocuments(),
      db.collection('opportunities').countDocuments({ status: { $in: ['Active', 'active'] } }),
      db.collection('applications').countDocuments(),
      db.collection('jobs').countDocuments(),
      db.collection('sponsorships').countDocuments()
    ]);

    res.status(200).json({
      success: true,
      message: 'Platform statistics fetched successfully',
      data: {
        athletes: { total: totalAthletes, verified: verifiedAthletes },
        organizations: { total: totalOrganizations, verified: verifiedOrganizations },
        opportunities: { total: totalOpportunities, active: activeOpportunities },
        applications: { total: totalApplications },
        jobs: { total: totalJobs },
        sponsorships: { total: totalSponsorships }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists all users across athlete and organization collections with pagination and filtering.
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const db = getDb();
    const { role = 'all', status, page = 1, limit = 20, search } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    let users = [];
    let total = 0;

    const buildFilter = (collectionName) => {
      const q = {};
      if (status) q.status = status;
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (collectionName === 'athletes') {
          q.$or = [
            { firstName: { $regex: escaped, $options: 'i' } },
            { lastName: { $regex: escaped, $options: 'i' } },
            { email: { $regex: escaped, $options: 'i' } }
          ];
        } else {
          q.$or = [
            { name: { $regex: escaped, $options: 'i' } },
            { email: { $regex: escaped, $options: 'i' } }
          ];
        }
      }
      return q;
    };

    if (role === 'athlete') {
      const q = buildFilter('athletes');
      users = await db.collection('athletes').find(q).skip(skip).limit(limitNum).toArray();
      total = await db.collection('athletes').countDocuments(q);
    } else if (role === 'organization') {
      const q = buildFilter('organizations');
      users = await db.collection('organizations').find(q).skip(skip).limit(limitNum).toArray();
      total = await db.collection('organizations').countDocuments(q);
    } else {
      const [athleteCount, orgCount] = await Promise.all([
        db.collection('athletes').countDocuments(buildFilter('athletes')),
        db.collection('organizations').countDocuments(buildFilter('organizations'))
      ]);
      total = athleteCount + orgCount;

      // Treat athletes+organizations as one continuous ordered list and compute
      // each collection's slice of the current page via virtual offsets, so a
      // page always returns up to `limitNum` users with no gaps or duplicates
      // across pages (the previous halfLimit split under/over-fetched).
      const athleteSkip = Math.min(skip, athleteCount);
      const athleteTake = Math.max(0, Math.min(limitNum, athleteCount - athleteSkip));
      const orgSkip = Math.max(0, skip - athleteCount);
      const orgTake = Math.max(0, limitNum - athleteTake);

      const [athletes, orgs] = await Promise.all([
        athleteTake > 0
          ? db.collection('athletes').find(buildFilter('athletes')).skip(athleteSkip).limit(athleteTake).toArray()
          : [],
        orgTake > 0
          ? db.collection('organizations').find(buildFilter('organizations')).skip(orgSkip).limit(orgTake).toArray()
          : []
      ]);
      users = [...athletes, ...orgs];
    }

    // Clean password hashes from output
    const cleanUsers = users.map(u => {
      const safe = { ...u };
      delete safe.passwordHash;
      return safe;
    });

    res.status(200).json({
      success: true,
      data: {
        users: cleanUsers,
        total,
        page: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a user's account status (ACTIVE, SUSPENDED, DEACTIVATED).
 */
export const updateUserStatus = async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status, role = 'athlete' } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].includes(status)) {
      throw new ValidationError('Status must be ACTIVE, SUSPENDED, or DEACTIVATED');
    }

    const collectionName = role === 'organization' ? 'organizations' : 'athletes';
    const idField = role === 'organization' ? 'orgId' : 'athleteId';
    const query = safeIdQuery(id, idField);

    const result = await db.collection(collectionName).findOneAndUpdate(
      query,
      { $set: { status, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) throw new NotFoundError('User not found');

    const cleanUser = { ...result };
    delete cleanUser.passwordHash;

    logger.info(`Admin updated user ${id} status to ${status}`);
    res.status(200).json({
      success: true,
      message: `User status updated to ${status}`,
      data: cleanUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin verifies or rejects an organization.
 */
export const verifyOrganization = async (req, res, next) => {
  try {
    const db = getDb();
    const { orgId } = req.params;
    const { isVerified = true, notes = '' } = req.body;

    const query = safeIdQuery(orgId, 'orgId');
    const result = await db.collection('organizations').findOneAndUpdate(
      query,
      {
        $set: {
          isVerified: Boolean(isVerified),
          verificationNotes: notes,
          verifiedAt: new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) throw new NotFoundError('Organization not found');

    const cleanOrg = { ...result };
    delete cleanOrg.passwordHash;

    // Notify organization
    await createNotification({
      userId: cleanOrg._id.toString(),
      title: isVerified ? '🏢 Organization Verified!' : '⚠️ Organization Verification Update',
      message: isVerified
        ? 'Your organization profile has been officially verified by the platform admin.'
        : `Your organization verification was rejected. Reason: ${notes || 'Information provided did not meet criteria.'}`,
      type: 'SYSTEM',
      data: { orgId, isVerified }
    });

    res.status(200).json({
      success: true,
      message: `Organization verification set to ${isVerified}`,
      data: cleanOrg
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin moderates an opportunity (Active, Closed, Cancelled).
 */
export const moderateOpportunity = async (req, res, next) => {
  try {
    const db = getDb();
    const { oppId } = req.params;
    const { status = 'Active', reason = '' } = req.body;
    const allowedStatuses = ['Active', 'Closed', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      throw new ValidationError(`Invalid opportunity status. Allowed values: ${allowedStatuses.join(', ')}`);
    }

    const query = safeIdQuery(oppId, 'oppId');
    const result = await db.collection('opportunities').findOneAndUpdate(
      query,
      { $set: { status, moderationReason: reason, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!result) throw new NotFoundError('Opportunity not found');

    res.status(200).json({
      success: true,
      message: `Opportunity status updated to ${status}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 17 Master Spec: Admin Reports & Abuse Moderation
 */
export const getReports = async (req, res, next) => {
  try {
    const { getAllReports } = await import('../models/Report.js');
    const { status, limit = 50, skip = 0 } = req.query;
    const reports = await getAllReports({ status, limit: parseInt(limit, 10), skip: parseInt(skip, 10) });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

export const fileReport = async (req, res, next) => {
  try {
    const { createReport } = await import('../models/Report.js');
    const { targetType, targetId, reason, description } = req.body;
    if (!targetType || !targetId || !reason) {
      throw new ValidationError('targetType, targetId, and reason are required');
    }

    const report = await createReport({
      reporterId: req.user?.id || 'anonymous',
      reporterRole: req.user?.role || req.user?.userType || 'athlete',
      targetType,
      targetId,
      reason,
      description
    });

    res.status(201).json({
      success: true,
      message: 'Report filed successfully. Moderation team will review.',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

export const moderateReportHandler = async (req, res, next) => {
  try {
    const { moderateReport } = await import('../models/Report.js');
    const { reportId } = req.params;
    const { status = 'RESOLVED', actionTaken = 'Content Reviewed' } = req.body;

    const updated = await moderateReport(reportId, {
      status,
      actionTaken,
      adminId: req.user?.id
    });

    if (!updated) throw new NotFoundError('Report not found');

    res.status(200).json({
      success: true,
      message: `Report status set to ${status}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 17 Master Spec: Sports Category Governance
 */
export const getCategories = async (req, res, next) => {
  try {
    const { getAllCategories } = await import('../models/Category.js');
    const categories = await getAllCategories();
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { addCategory } = await import('../models/Category.js');
    const { name, type = 'sport' } = req.body;
    if (!name) throw new ValidationError('Category name is required');

    const created = await addCategory({ name, type });
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: created
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { removeCategory } = await import('../models/Category.js');
    const { id } = req.params;
    const result = await removeCategory(id);
    if (!result) throw new NotFoundError('Category not found');

    res.status(200).json({
      success: true,
      message: 'Category deactivated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

