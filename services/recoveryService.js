import { getAthleteSessions } from '../models/TrainingSession.js';
import { logger } from '../utils/logger.js';

/**
 * Section 10 Master Spec: Recovery Intelligence Module
 * Analyzes past training days and flags when 3+ consecutive days show High Intensity load.
 *
 * @param {string} athleteId
 * @returns {Promise<Object>} Recovery status and personalized guidance.
 */
export const analyzeRecoveryStatus = async (athleteId) => {
  try {
    // Fetch last 14 days of workout sessions
    const sessions = await getAthleteSessions(athleteId, { limit: 30 });

    // Group sessions by date (YYYY-MM-DD)
    const dayLoads = new Map();
    for (const session of sessions) {
      const dateKey = new Date(session.date).toISOString().split('T')[0];
      const isHigh = session.intensity === 'High' || session.calories > 600 || session.duration > 75;
      
      if (!dayLoads.has(dateKey)) {
        dayLoads.set(dateKey, { isHigh, totalDuration: session.duration, totalCalories: session.calories });
      } else {
        const existing = dayLoads.get(dateKey);
        existing.isHigh = existing.isHigh || isHigh;
        existing.totalDuration += session.duration;
        existing.totalCalories += session.calories;
      }
    }

    // Sort days chronologically descending
    const sortedDates = Array.from(dayLoads.keys()).sort((a, b) => new Date(b) - new Date(a));

    // Count consecutive high-intensity days starting from the most recent training day
    // Verifies that days are truly consecutive calendar days (gap == 1 day) and within the last 48 hours
    let consecutiveHighDays = 0;
    const now = new Date();
    let prevDate = null;

    if (sortedDates.length > 0) {
      const mostRecentDate = new Date(sortedDates[0]);
      const hoursSinceLastWorkout = (now - mostRecentDate) / (1000 * 60 * 60);

      if (hoursSinceLastWorkout <= 48) {
        for (const dateStr of sortedDates) {
          const currentDate = new Date(dateStr);
          if (prevDate) {
            const diffDays = Math.round((prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays !== 1) {
              // Streak broken by rest day or gap
              break;
            }
          }
          const day = dayLoads.get(dateStr);
          if (day.isHigh) {
            consecutiveHighDays++;
            prevDate = currentDate;
          } else {
            break;
          }
        }
      }
    }

    const recoveryDayRecommended = consecutiveHighDays >= 3;

    return {
      athleteId,
      recoveryDayRecommended,
      consecutiveHighDays,
      trainingLoadAlert: recoveryDayRecommended
        ? `⚠️ High intensity training detected for ${consecutiveHighDays} consecutive days. Rest or active recovery strongly advised.`
        : `✅ Training load within balanced limits (${consecutiveHighDays} consecutive high-load day${consecutiveHighDays === 1 ? '' : 's'}).`,
      recommendations: {
        mobilitySuggestion: recoveryDayRecommended
          ? 'Focus on 15 minutes of foam rolling (quads, IT bands, calves) and cat-cow spine mobility.'
          : 'Standard 10-minute dynamic warmup mobility.',
        stretchingSuggestion: recoveryDayRecommended
          ? 'Deep static stretching: Hamstring stretch, pigeon pose, hip flexor hold (30-45 seconds each).'
          : 'Routine post-workout light stretching.',
        lightActivitySuggestion: recoveryDayRecommended
          ? 'Active recovery: 20-minute gentle walk, easy swimming, or low-resistance spin.'
          : 'Maintain scheduled training session.',
        hydrationReminder: 'Target 3.0 to 3.5 liters of water with electrolyte replenishment after training.',
        sleepRecommendation: recoveryDayRecommended
          ? 'Aim for 8.5 to 9 hours of sleep tonight for complete neuromuscular and glycogen recovery.'
          : 'Maintain consistent 7.5 to 8 hours sleep schedule.'
      },
      disclaimer: 'General wellness and athletic conditioning guidance only. Not medical diagnosis or therapeutic treatment.'
    };
  } catch (error) {
    logger.error('Error analyzing recovery status', { error: error.message });
    throw error;
  }
};
