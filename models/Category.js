import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { SPORTS } from '../utils/constants.js';

export const getCategoriesCollection = () => {
  return getDb().collection('categories');
};

/**
 * Initializes default categories if collection is empty.
 */
export const initDefaultCategories = async () => {
  try {
    const coll = getCategoriesCollection();
    const count = await coll.countDocuments();
    if (count === 0) {
      const defaultDocs = SPORTS.map(name => ({
        categoryId: crypto.randomUUID(),
        name,
        type: 'sport',
        active: true,
        createdAt: new Date()
      }));
      await coll.insertMany(defaultDocs);
      logger.info(`Initialized ${defaultDocs.length} default sport categories`);
    }
  } catch (error) {
    logger.warn('Failed to seed default categories', { error: error.message });
  }
};

/**
 * Fetches all active sports categories.
 */
export const getAllCategories = async () => {
  try {
    await initDefaultCategories();
    return await getCategoriesCollection().find({ active: true }).sort({ name: 1 }).toArray();
  } catch (error) {
    logger.error('Error fetching categories', { error: error.message });
    throw error;
  }
};

/**
 * Adds a new category.
 */
export const addCategory = async ({ name, type = 'sport' }) => {
  try {
    const categoryId = crypto.randomUUID();
    const newCat = {
      categoryId,
      name,
      type,
      active: true,
      createdAt: new Date()
    };
    await getCategoriesCollection().insertOne(newCat);
    logger.info(`Added category: ${name}`);
    return newCat;
  } catch (error) {
    logger.error('Error adding category', { error: error.message });
    throw error;
  }
};

/**
 * Soft deletes / deactivates a category.
 */
export const removeCategory = async (id) => {
  try {
    const query = { $or: [{ categoryId: id }, { name: id }] };
    try { query.$or.push({ _id: new ObjectId(id) }); } catch (e) {}

    return await getCategoriesCollection().findOneAndUpdate(
      query,
      { $set: { active: false, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
  } catch (error) {
    logger.error('Error removing category', { error: error.message });
    throw error;
  }
};
