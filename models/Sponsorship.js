import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';


/**
 * Returns the sponsorships collection.
 *
 * @returns {import('mongodb').Collection} The MongoDB collection.
 */
export const getSponsorshipsCollection = () => {
  return getDb().collection('sponsorships');
};

/**
 * Creates a new sponsorship posting.
 *
 * @param {Object} sponsorshipData - The sponsorship data.
 * @returns {Promise<Object>} The created sponsorship document.
 */
export const createSponsorship = async ({
  postedBy,
  title,
  sport,
  description,
  amount,
  eligibility,
  deadline,
}) => {
  try {
    const sponsorId = crypto.randomUUID();

    const newSponsorship = {
      sponsorId,
      postedBy, // orgId
      title,
      sport,
      description,
      amount,
      eligibility,
      deadline: new Date(deadline),
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getSponsorshipsCollection().insertOne(newSponsorship);
    logger.info(`Created sponsorship with ID: ${sponsorId}`);
    return { ...newSponsorship, _id: result.insertedId };
  } catch (error) {
    logger.error(`Error in createSponsorship: ${error.message}`);
    throw error;
  }
};

/**
 * Finds a sponsorship by ID.
 *
 * @param {string} sponsorId - The sponsorship ID.
 * @returns {Promise<Object|null>} The sponsorship document or null.
 */
export const findSponsorshipById = async (sponsorId) => {
  try {
    return await getSponsorshipsCollection().findOne({ sponsorId });
  } catch (error) {
    logger.error(`Error in findSponsorshipById: ${error.message}`);
    throw error;
  }
};

/**
 * Gets paginated active sponsorships based on filters.
 *
 * @param {Object} filters - Search filters.
 * @param {number} page - The page number.
 * @param {number} limit - The number of items per page.
 * @returns {Promise<Array>} The list of sponsorships.
 */
export const getActiveSponsorships = async (filters = {}, page = 1, limit = 10) => {
  try {
    const query = {
      status: 'Active',
      deadline: { $gt: new Date() },
      ...filters,
    };

    const skip = (page - 1) * limit;

    const sponsorships = await getSponsorshipsCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return sponsorships;
  } catch (error) {
    logger.error(`Error in getActiveSponsorships: ${error.message}`);
    throw error;
  }
};

/**
 * Updates a sponsorship's status.
 *
 * @param {string} sponsorId - The sponsorship ID.
 * @param {string} status - The new status.
 * @returns {Promise<boolean>} True if updated successfully.
 */
export const updateSponsorshipStatus = async (sponsorId, status) => {
  try {
    const result = await getSponsorshipsCollection().updateOne(
      { sponsorId },
      { $set: { status, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in updateSponsorshipStatus: ${error.message}`);
    throw error;
  }
};

/**
 * Gets all sponsorships posted by a specific organization.
 *
 * @param {string} orgId - The organization ID.
 * @returns {Promise<Array>} List of sponsorships.
 */
export const getSponsorshipsByOrg = async (orgId) => {
  try {
    return await getSponsorshipsCollection()
      .find({ postedBy: orgId })
      .sort({ createdAt: -1 })
      .toArray();
  } catch (error) {
    logger.error(`Error in getSponsorshipsByOrg: ${error.message}`);
    throw error;
  }
};
