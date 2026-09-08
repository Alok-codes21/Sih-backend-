import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';


/**
 * Returns the applications collection.
 *
 * @returns {import('mongodb').Collection} The MongoDB collection.
 */
export const getApplicationsCollection = () => {
  return getDb().collection('applications');
};

/**
 * Creates a new application.
 *
 * @param {Object} applicationData - The application data.
 * @returns {Promise<Object>} The created application.
 */
export const createApplication = async ({
  athleteId,
  targetId,
  targetType,
  message,
}) => {
  try {
    const applicationId = crypto.randomUUID();

    const newApplication = {
      applicationId,
      athleteId,
      targetId,
      targetType, // 'Opportunity', 'Job', 'Sponsorship'
      message,
      status: 'Applied',
      appliedAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getApplicationsCollection().insertOne(newApplication);
    logger.info(`Created application with ID: ${applicationId}`);
    return { ...newApplication, _id: result.insertedId };
  } catch (error) {
    logger.error(`Error in createApplication: ${error.message}`);
    throw error;
  }
};

/**
 * Checks if an athlete has already applied to a specific target.
 *
 * @param {string} athleteId - The athlete ID.
 * @param {string} targetId - The target ID (opportunity, job, sponsorship).
 * @returns {Promise<Object|null>} The existing application or null.
 */
export const findExistingApplication = async (athleteId, targetId) => {
  try {
    return await getApplicationsCollection().findOne({ athleteId, targetId });
  } catch (error) {
    logger.error(`Error in findExistingApplication: ${error.message}`);
    throw error;
  }
};

/**
 * Gets all applications submitted by an athlete, optionally filtered by type.
 *
 * @param {string} athleteId - The athlete ID.
 * @param {string} [targetType] - Optional filter for target type.
 * @returns {Promise<Array>} List of applications.
 */
export const getApplicationsByAthlete = async (athleteId, targetType) => {
  try {
    const query = { athleteId };
    if (targetType) {
      query.targetType = targetType;
    }

    return await getApplicationsCollection()
      .find(query)
      .sort({ appliedAt: -1 })
      .toArray();
  } catch (error) {
    logger.error(`Error in getApplicationsByAthlete: ${error.message}`);
    throw error;
  }
};

/**
 * Gets all applications for a specific target (opportunity, job, etc.).
 *
 * @param {string} targetId - The target ID.
 * @returns {Promise<Array>} List of applications.
 */
export const getApplicationsByTarget = async (targetId) => {
  try {
    return await getApplicationsCollection()
      .find({ targetId })
      .sort({ appliedAt: -1 })
      .toArray();
  } catch (error) {
    logger.error(`Error in getApplicationsByTarget: ${error.message}`);
    throw error;
  }
};

/**
 * Updates the status of an application.
 *
 * @param {string} applicationId - The application ID.
 * @param {string} status - The new status ('Shortlisted', 'Selected', 'Rejected').
 * @returns {Promise<boolean>} True if updated successfully.
 */
export const updateApplicationStatus = async (applicationId, status) => {
  try {
    const result = await getApplicationsCollection().updateOne(
      { applicationId },
      { $set: { status, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in updateApplicationStatus: ${error.message}`);
    throw error;
  }
};
