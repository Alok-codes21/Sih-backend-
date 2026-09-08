import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const getTrainingSessionsCollection = () => {
  return getDb().collection('training_sessions');
};

/**
 * Creates a new training session record in MongoDB.
 */
export const createTrainingSession = async ({
  athleteId,
  activity = 'Running',
  duration = 0,
  distance = 0,
  calories = 0,
  heartRate = 0,
  date = new Date(),
  intensity = 'Medium',
  sleepHours = null,
  sleepQuality = null,
  notes = '',
  source = 'Manual'
}) => {
  try {
    const sessionId = crypto.randomUUID();
    const sessionDate = date ? new Date(date) : new Date();

    // Auto-compute intensity if not provided
    let calcIntensity = intensity;
    if (!calcIntensity || calcIntensity === 'Auto') {
      if (calories > 500 || heartRate > 165) calcIntensity = 'High';
      else if (calories > 250 || heartRate > 130) calcIntensity = 'Medium';
      else calcIntensity = 'Low';
    }

    const newSession = {
      sessionId,
      athleteId: athleteId.toString(),
      activity, // Running, Cycling, Strength training, Swimming, Football, Cricket, etc.
      duration: Number(duration) || 0, // in minutes
      distance: Number(distance) || 0, // in km
      calories: Number(calories) || 0,
      heartRate: Number(heartRate) || 0, // BPM
      intensity: calcIntensity, // Low, Medium, High
      date: sessionDate,
      sleepHours: sleepHours !== null ? Number(sleepHours) : null,
      sleepQuality: sleepQuality || null,
      notes: notes || '',
      source, // 'Manual' | 'Wearable' | 'GoogleFit'
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await getTrainingSessionsCollection().insertOne(newSession);
    logger.info(`Training session created: ${sessionId} for athlete ${athleteId}`);
    return { ...newSession, _id: result.insertedId };
  } catch (error) {
    logger.error('Error in createTrainingSession', { error: error.message });
    throw error;
  }
};

/**
 * Retrieves past training sessions for an athlete.
 */
export const getAthleteSessions = async (athleteId, { limit = 50, skip = 0, startDate, endDate } = {}) => {
  try {
    const athleteIdStr = athleteId.toString();
    const query = { athleteId: athleteIdStr };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    return await getTrainingSessionsCollection()
      .find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  } catch (error) {
    logger.error('Error fetching athlete training sessions', { error: error.message });
    throw error;
  }
};
