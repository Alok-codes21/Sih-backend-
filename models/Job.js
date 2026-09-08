import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';


/**
 * Returns the jobs collection.
 *
 * @returns {import('mongodb').Collection} The MongoDB collection.
 */
export const getJobsCollection = () => {
  return getDb().collection('jobs');
};

/**
 * Creates a new job posting.
 *
 * @param {Object} jobData - The job data.
 * @returns {Promise<Object>} The created job document.
 */
export const createJob = async ({
  postedBy,
  title,
  sport,
  type,
  description,
  salary,
  eligibility,
  location,
  remote,
  deadline,
}) => {
  try {
    const jobId = crypto.randomUUID();

    const newJob = {
      jobId,
      postedBy, // orgId
      title,
      sport,
      type, // 'Full-time', 'Part-time', 'Contract', etc.
      description,
      salary: {
        min: salary?.min || null,
        max: salary?.max || null,
        currency: salary?.currency || 'USD',
      },
      eligibility,
      location,
      remote: remote || false,
      deadline: new Date(deadline),
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getJobsCollection().insertOne(newJob);
    logger.info(`Created job with ID: ${jobId}`);
    return { ...newJob, _id: result.insertedId };
  } catch (error) {
    logger.error(`Error in createJob: ${error.message}`);
    throw error;
  }
};

/**
 * Finds a job by ID.
 *
 * @param {string} jobId - The job ID.
 * @returns {Promise<Object|null>} The job document or null.
 */
export const findJobById = async (jobId) => {
  try {
    return await getJobsCollection().findOne({ jobId });
  } catch (error) {
    logger.error(`Error in findJobById: ${error.message}`);
    throw error;
  }
};

/**
 * Gets paginated active jobs based on filters.
 *
 * @param {Object} filters - Search filters.
 * @param {number} page - The page number.
 * @param {number} limit - The number of items per page.
 * @returns {Promise<Array>} The list of jobs.
 */
export const getActiveJobs = async (filters = {}, page = 1, limit = 10) => {
  try {
    const query = {
      status: 'Active',
      deadline: { $gt: new Date() },
      ...filters,
    };

    const skip = (page - 1) * limit;

    const jobs = await getJobsCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return jobs;
  } catch (error) {
    logger.error(`Error in getActiveJobs: ${error.message}`);
    throw error;
  }
};

/**
 * Updates a job's status.
 *
 * @param {string} jobId - The job ID.
 * @param {string} status - The new status.
 * @returns {Promise<boolean>} True if updated successfully.
 */
export const updateJobStatus = async (jobId, status) => {
  try {
    const result = await getJobsCollection().updateOne(
      { jobId },
      { $set: { status, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in updateJobStatus: ${error.message}`);
    throw error;
  }
};

/**
 * Gets all jobs posted by a specific organization.
 *
 * @param {string} orgId - The organization ID.
 * @returns {Promise<Array>} List of jobs.
 */
export const getJobsByOrg = async (orgId) => {
  try {
    return await getJobsCollection()
      .find({ postedBy: orgId })
      .sort({ createdAt: -1 })
      .toArray();
  } catch (error) {
    logger.error(`Error in getJobsByOrg: ${error.message}`);
    throw error;
  }
};
