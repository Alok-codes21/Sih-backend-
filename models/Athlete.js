import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';


/**
 * Returns the athletes collection.
 *
 * @returns {import('mongodb').Collection} The MongoDB collection.
 */
export const getAthletesCollection = () => {
  return getDb().collection('athletes');
};

/**
 * Creates a new athlete in the database.
 *
 * @param {Object} athleteData - The athlete data.
 * @returns {Promise<Object>} The inserted athlete document.
 */
export const createAthlete = async ({
  email,
  passwordHash,
  firstName,
  lastName,
  dateOfBirth,
  gender,
  sport,
  city,
  state,
  country,
}) => {
  try {
    const db = getDb();
    const athleteId = crypto.randomUUID();

    // Calculate age
    const dob = new Date(dateOfBirth);
    const ageDifMs = Date.now() - dob.getTime();
    const ageDate = new Date(ageDifMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);

    // Determine age group
    let ageGroup = 'Adult';
    if (age < 13) ageGroup = 'Child';
    else if (age < 18) ageGroup = 'Teen';
    else if (age > 40) ageGroup = 'Veteran';

    const newAthlete = {
      athleteId,
      email,
      passwordHash,
      firstName,
      lastName,
      dateOfBirth,
      age,
      ageGroup,
      gender,
      sport,
      city,
      state,
      country,
      physicalStats: {
        height: null,
        weight: null,
        bmi: null,
      },
      achievements: [],
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await getAthletesCollection().insertOne(newAthlete);
    logger.info(`Created new athlete with ID: ${athleteId}`);
    
    return { ...newAthlete, _id: result.insertedId };
  } catch (error) {
    logger.error(`Error in createAthlete: ${error.message}`);
    throw error;
  }
};

/**
 * Finds an athlete by email.
 *
 * @param {string} email - The email to search for.
 * @returns {Promise<Object|null>} The athlete document or null.
 */
export const findAthleteByEmail = async (email) => {
  try {
    return await getAthletesCollection().findOne({ email });
  } catch (error) {
    logger.error(`Error in findAthleteByEmail: ${error.message}`);
    throw error;
  }
};

/**
 * Finds an athlete by their ID.
 *
 * @param {string} athleteId - The athlete ID.
 * @returns {Promise<Object|null>} The athlete document or null.
 */
export const findAthleteById = async (athleteId) => {
  try {
    return await getAthletesCollection().findOne({ athleteId });
  } catch (error) {
    logger.error(`Error in findAthleteById: ${error.message}`);
    throw error;
  }
};

/**
 * Updates an athlete's data.
 *
 * @param {string} athleteId - The athlete ID.
 * @param {Object} updateData - Data to update.
 * @returns {Promise<boolean>} True if updated successfully.
 */
export const updateAthlete = async (athleteId, updateData) => {
  try {
    // Prevent updating critical fields
    delete updateData.email;
    delete updateData.passwordHash;
    delete updateData.athleteId;
    delete updateData._id;

    updateData.updatedAt = new Date();

    const result = await getAthletesCollection().updateOne(
      { athleteId },
      { $set: updateData }
    );
    
    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in updateAthlete: ${error.message}`);
    throw error;
  }
};

/**
 * Adds an achievement to an athlete.
 *
 * @param {string} athleteId - The athlete ID.
 * @param {Object} achievement - The achievement details.
 * @returns {Promise<boolean>} True if added successfully.
 */
export const addAchievement = async (athleteId, achievement) => {
  try {
    const achievementWithId = {
      achievementId: crypto.randomUUID(),
      ...achievement,
      addedAt: new Date(),
    };

    const result = await getAthletesCollection().updateOne(
      { athleteId },
      { $push: { achievements: achievementWithId }, $set: { updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in addAchievement: ${error.message}`);
    throw error;
  }
};

/**
 * Removes an achievement from an athlete.
 *
 * @param {string} athleteId - The athlete ID.
 * @param {string} achievementId - The achievement ID to remove.
 * @returns {Promise<boolean>} True if removed successfully.
 */
export const removeAchievement = async (athleteId, achievementId) => {
  try {
    const result = await getAthletesCollection().updateOne(
      { athleteId },
      { $pull: { achievements: { achievementId } }, $set: { updatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in removeAchievement: ${error.message}`);
    throw error;
  }
};

/**
 * Updates physical stats and auto-calculates BMI.
 *
 * @param {string} athleteId - The athlete ID.
 * @param {Object} stats - The height (cm) and weight (kg).
 * @returns {Promise<boolean>} True if updated successfully.
 */
export const updatePhysicalStats = async (athleteId, { height, weight }) => {
  try {
    const { calculateBMI } = await import('../utils/validators.js');
    const bmi = calculateBMI(height, weight); // height in cm, weight in kg

    const result = await getAthletesCollection().updateOne(
      { athleteId },
      { 
        $set: { 
          'physicalStats.height': height,
          'physicalStats.weight': weight,
          'physicalStats.bmi': bmi,
          updatedAt: new Date()
        } 
      }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    logger.error(`Error in updatePhysicalStats: ${error.message}`);
    throw error;
  }
};
