import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';


/**
 * Returns the opportunities collection.
 *
 * @returns {import('mongodb').Collection} The MongoDB collection.
 */
export const getOpportunitiesCollection = () => {
  return getDb().collection('opportunities');
};

/**
 * Creates a new opportunity.
 *
 * @param {Object} opportunityData - The opportunity data.
 * @returns {Promise<Object>} The created opportunity.
 */
export const createOpportunity = async ({
  postedBy,
  title,
  type,
  sport,
  description,
  eligibility,
  deadline,
  location,
  monetaryBenefit,
}) => {
  try {
    const oppId = crypto.randomUUID();

    const newOpportunity = {
      oppId,
      postedBy, // orgId
      title,
      type,
      sport,
      description,
      eligibility: {
        minAge: eligibility?.minAge || null,
        maxAge: eligibility?.maxAge || null,
        gender: eligibility?.gender || 'Any',
        minExperience: eligibility?.minExperience || null,
        requiredLevel: eligibility?.requiredLevel || 'Any',
        states: eligibility?.states || [],
      },
      deadline: new Date(deadline),
      location,
      monetaryBenefit,
      status: 'Active', // Default status
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getOpportunitiesCollection().insertOne(newOpportunity);
    logger.info(`Created opportunity with ID: ${oppId}`);
    return { ...newOpportunity, _id: result.insertedId };
  } catch (error) {
    logger.error(`Error in createOpportunity: ${error.message}`);
    throw error;
  }
};

/**
 * Finds an opportunity by ID.
 *
 * @param {string} oppId - The opportunity ID.
 * @returns {Promise<Object|null>} The opportunity document or null.
 */
export const findOpportunityById = async (oppId) => {
  try {
    return await getOpportunitiesCollection().findOne({ oppId });
  } catch (error) {
    logger.error(`Error in findOpportunityById: ${error.message}`);
    throw error;
  }
};

/**
 * Gets paginated active opportunities based on filters.
 *
 * @param {Object} filters - Search filters.
 * @param {number} page - The page number.
 * @param {number} limit - The number of items per page.
 * @returns {Promise<Array>} The list of opportunities.
 */
export const getActiveOpportunities = async (filters = {}, page = 1, limit = 10) => {
  try {
    const query = {
      status: 'Active',
      deadline: { $gt: new Date() },
      ...filters,
    };

    const skip = (page - 1) * limit;

    const opportunities = await getOpportunitiesCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return opportunities;
  } catch (error) {
    logger.error(`Error in getActiveOpportunities: ${error.message}`);
    throw error;
  }
};

/**
 * Updates an opportunity's status.
 *
 * @param {string} oppId - The opportunity ID.
 * @param {string} status - The new status.
 * @returns {Promise<boolean>} True if updated successfully.
 */
export const updateOpportunityStatus = async (oppId, status) => {
  try {
    const result = await getOpportunitiesCollection().updateOne(
      { oppId },
      { $set: { status, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in updateOpportunityStatus: ${error.message}`);
    throw error;
  }
};

/**
 * Gets all opportunities posted by a specific organization.
 *
 * @param {string} orgId - The organization ID.
 * @returns {Promise<Array>} List of opportunities.
 */
export const getOpportunitiesByOrg = async (orgId) => {
  try {
    return await getOpportunitiesCollection()
      .find({ postedBy: orgId })
      .sort({ createdAt: -1 })
      .toArray();
  } catch (error) {
    logger.error(`Error in getOpportunitiesByOrg: ${error.message}`);
    throw error;
  }
};
