import { logger } from '../utils/logger.js';
import { ObjectId } from 'mongodb';

/**
 * Safely creates a MongoDB ObjectId from a string.
 * Returns null if the string is not a valid 24-character hex string.
 *
 * @param {string} id - The ID string to convert.
 * @returns {ObjectId|null}
 */
export const safeObjectId = (id) => {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
};

/**
 * Builds a MongoDB query that matches both a custom string ID field
 * and the native _id ObjectId. This handles the dual-ID pattern used
 * throughout the application.
 *
 * @param {string} id - The ID value to search for.
 * @param {string} [fieldName='athleteId'] - The custom ID field name.
 * @returns {Object} A MongoDB $or query.
 */
export const buildIdQuery = (id, fieldName = 'athleteId') => {
  const query = { $or: [{ [fieldName]: id }] };
  const oid = safeObjectId(id);
  if (oid) query.$or.push({ _id: oid });
  return query;
};

/**
 * Escapes special regex characters in a string for safe use in MongoDB $regex.
 *
 * @param {string} str - The string to escape.
 * @returns {string}
 */
export const escapeRegex = (str) => {
  return str ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
};
