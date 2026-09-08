import { logger } from '../utils/logger.js';

/**
 * Creates all required MongoDB indexes for performance and data integrity.
 * Called once during server startup after DB connection is established.
 *
 * @param {import('mongodb').Db} db - The MongoDB database instance.
 */
export const initIndexes = async (db) => {
  try {
    // ── Unique indexes (data integrity) ──────────────────────────────
    await db.collection('athletes').createIndex({ email: 1 }, { unique: true });
    await db.collection('athletes').createIndex({ athleteId: 1 }, { unique: true, sparse: true });
    await db.collection('organizations').createIndex({ email: 1 }, { unique: true });
    await db.collection('organizations').createIndex({ orgId: 1 }, { unique: true, sparse: true });
    await db.collection('admins').createIndex({ email: 1 }, { unique: true });

    // ── Performance indexes ──────────────────────────────────────────
    // Applications — dedup check + athlete/org lookups
    await db.collection('applications').createIndex({ athleteId: 1, targetId: 1 });
    await db.collection('applications').createIndex({ orgId: 1 });
    // Deterministic unique key closes the check-then-insert race for new applications.
    // sparse keeps legacy documents without dedupeKey compatible.
    await db.collection('applications').createIndex({ dedupeKey: 1 }, { unique: true, sparse: true });

    // Notifications — user feed sorted by time
    await db.collection('notifications').createIndex({ userId: 1, createdAt: -1 });

    // Training sessions — athlete history
    await db.collection('training_sessions').createIndex({ athleteId: 1, date: -1 });

    // Training plans — active plan lookup
    await db.collection('training_plans').createIndex({ athleteId: 1, status: 1 });

    // Athlete stats — sport-specific stat upserts
    await db.collection('athlete_stats').createIndex(
      { athleteId: 1, sport: 1, statName: 1 },
      { unique: true }
    );

    // Refresh tokens — lookup + auto-expire
    await db.collection('refresh_tokens').createIndex({ token: 1 });
    await db.collection('refresh_tokens').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }   // TTL index — MongoDB auto-deletes expired docs
    );

    // Listings — active listing queries
    await db.collection('opportunities').createIndex({ status: 1, deadline: 1 });
    await db.collection('jobs').createIndex({ status: 1, deadline: 1 });
    await db.collection('sponsorships').createIndex({ status: 1, deadline: 1 });

    // Listings — org lookup
    await db.collection('opportunities').createIndex({ postedBy: 1 });
    await db.collection('jobs').createIndex({ postedBy: 1 });
    await db.collection('sponsorships').createIndex({ postedBy: 1 });

    // Reports — admin moderation
    await db.collection('reports').createIndex({ status: 1, createdAt: -1 });

    // Chat & exercise history
    await db.collection('chat_history').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('exercise_history').createIndex({ userId: 1, createdAt: -1 });

    logger.info('All MongoDB indexes created/verified successfully');
  } catch (error) {
    logger.error('Failed to create MongoDB indexes', { error: error.message });
    // Non-fatal — server can still run, just slower queries
  }
};
