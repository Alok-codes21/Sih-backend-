import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';


/**
 * Returns the organizations collection.
 *
 * @returns {import('mongodb').Collection} The MongoDB collection.
 */
export const getOrgsCollection = () => {
  return getDb().collection('organizations');
};

/**
 * Creates a new organization in the database.
 *
 * @param {Object} orgData - The organization data.
 * @returns {Promise<Object>} The inserted organization document.
 */
export const createOrganization = async ({
  email,
  passwordHash,
  name,
  type,
  description,
  sports,
  city,
  state,
  country,
}) => {
  try {
    const orgId = crypto.randomUUID();

    const newOrg = {
      orgId,
      email,
      passwordHash,
      name,
      type,
      description,
      sports: Array.isArray(sports) ? sports : [],
      city,
      state,
      country,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getOrgsCollection().insertOne(newOrg);
    logger.info(`Created new organization with ID: ${orgId}`);
    
    return { ...newOrg, _id: result.insertedId };
  } catch (error) {
    logger.error(`Error in createOrganization: ${error.message}`);
    throw error;
  }
};

/**
 * Finds an organization by email.
 *
 * @param {string} email - The email to search for.
 * @returns {Promise<Object|null>} The organization document or null.
 */
export const findOrgByEmail = async (email) => {
  try {
    return await getOrgsCollection().findOne({ email });
  } catch (error) {
    logger.error(`Error in findOrgByEmail: ${error.message}`);
    throw error;
  }
};

/**
 * Finds an organization by its ID.
 *
 * @param {string} orgId - The organization ID.
 * @returns {Promise<Object|null>} The organization document or null.
 */
export const findOrgById = async (orgId) => {
  try {
    return await getOrgsCollection().findOne({ orgId });
  } catch (error) {
    logger.error(`Error in findOrgById: ${error.message}`);
    throw error;
  }
};

/**
 * Updates an organization's data.
 *
 * @param {string} orgId - The organization ID.
 * @param {Object} updateData - Data to update.
 * @returns {Promise<boolean>} True if updated successfully.
 */
export const updateOrganization = async (orgId, updateData) => {
  try {
    // Prevent updating critical fields
    delete updateData.email;
    delete updateData.passwordHash;
    delete updateData.orgId;
    delete updateData._id;

    updateData.updatedAt = new Date();

    const result = await getOrgsCollection().updateOne(
      { orgId },
      { $set: updateData }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in updateOrganization: ${error.message}`);
    throw error;
  }
};
