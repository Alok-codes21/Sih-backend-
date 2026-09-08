import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const getAthleteStatsCollection = () => {
  return getDb().collection('athlete_stats');
};

/**
 * Creates or updates a dynamic sport-specific performance stat for an athlete.
 * Section 19 Master Spec: ATHLETE_STATS (id, athlete_id, stat_name, stat_value, sport)
 */
export const recordAthleteStat = async ({ athleteId, sport, statName, statValue, unit = '', recordedDate = new Date() }) => {
  try {
    const statId = crypto.randomUUID();
    const statDoc = {
      statId,
      athleteId: athleteId.toString(),
      sport,
      statName, // e.g. "100m time", "goals", "batting average"
      statValue: isNaN(Number(statValue)) ? statValue : Number(statValue),
      unit, // e.g. "seconds", "runs", "km/h"
      recordedDate: new Date(recordedDate),
      updatedAt: new Date()
    };

    // Upsert stat for the athlete + sport + statName combination
    const result = await getAthleteStatsCollection().findOneAndUpdate(
      { athleteId: athleteId.toString(), sport, statName },
      { $set: statDoc },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info(`Recorded stat '${statName}' for athlete ${athleteId}`);
    return result;
  } catch (error) {
    logger.error('Error in recordAthleteStat', { error: error.message });
    throw error;
  }
};

/**
 * Retrieves all sport performance stats for an athlete.
 */
export const getAthleteStats = async (athleteId, sport) => {
  try {
    const query = { athleteId: athleteId.toString() };
    if (sport) query.sport = sport;

    return await getAthleteStatsCollection()
      .find(query)
      .sort({ recordedDate: -1 })
      .toArray();
  } catch (error) {
    logger.error('Error fetching athlete stats', { error: error.message });
    throw error;
  }
};
