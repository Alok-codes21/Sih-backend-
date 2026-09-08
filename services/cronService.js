import cron from 'node-cron';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { createNotification } from '../models/Notification.js';

/**
 * Checks for opportunities expiring within the next 3 days and notifies eligible athletes.
 */
export const checkUpcomingDeadlines = async () => {
  try {
    const db = getDb();
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    // Find active opportunities whose deadline is between now and +3 days
    const expiringOpps = await db.collection('opportunities').find({
      status: { $in: ['Active', 'active'] },
      deadline: {
        $gt: now,
        $lte: threeDaysFromNow
      }
    }).toArray();

    if (expiringOpps.length === 0) {
      logger.info('Deadline check: No opportunities expiring within 3 days');
      return;
    }

    logger.info(`Deadline check: Found ${expiringOpps.length} opportunities expiring soon`);

    // Cache imports outside the loop
    const { calculateEligibilityScore } = await import('./matchingService.js');
    const { sendEmail } = await import('./emailService.js');

    // For each expiring opportunity, find matching athletes
    for (const opp of expiringOpps) {
      const daysLeft = Math.ceil((new Date(opp.deadline) - now) / (1000 * 60 * 60 * 24));
      const oppSport = opp.sport;

      // Find athletes who play this sport
      const athleteQuery = {};
      if (oppSport) {
        athleteQuery.$or = [
          { sport: oppSport },
          { sports: oppSport },
          { primarySport: oppSport }
        ];
      }

      const athletes = await db.collection('athletes').find(athleteQuery).toArray();

      for (const athlete of athletes) {
        const athleteId = athlete._id.toString();

        // Evaluate true eligibility. Previously this also notified anyone
        // with a raw score >= 50 even when isEligible was false — but
        // isEligible already fails when a hard filter fails (wrong gender,
        // missing a required verified achievement level, etc.), regardless
        // of how high the weighted score is. Notifying those athletes was
        // sending "you're a match!" deadline alerts for opportunities they
        // were actually blocked from applying to. Trust the isEligible flag.
        const eligibility = calculateEligibilityScore(athlete, opp, []);
        if (!eligibility.isEligible) continue;

        // Check if we already notified this athlete for this opp within the last 2 days
        const recentNotif = await db.collection('notifications').findOne({
          userId: athleteId,
          type: 'DEADLINE_ALERT',
          'data.oppId': (opp.oppId || opp._id).toString(),
          createdAt: { $gt: new Date(Date.now() - 48 * 60 * 60 * 1000) }
        });

        if (!recentNotif) {
          const title = `⏰ Urgent: ${opp.title} deadline in ${daysLeft} day${daysLeft > 1 ? 's' : ''}!`;
          const message = `The deadline for ${opp.title} is approaching on ${new Date(opp.deadline).toLocaleDateString()}. You have a ${eligibility.score}% match! Apply before applications close!`;

          await createNotification({
            userId: athleteId,
            title,
            message,
            type: 'DEADLINE_ALERT',
            data: {
              oppId: (opp.oppId || opp._id).toString(),
              title: opp.title,
              deadline: opp.deadline,
              daysLeft,
              matchScore: eligibility.score
            }
          });

          if (athlete.email) {
            await sendEmail({
              to: athlete.email,
              subject: title,
              text: message,
              html: `<div style="font-family: sans-serif; padding: 20px;">
                <h2 style="color: #2563eb;">${title}</h2>
                <p>${message}</p>
                <p><strong>Eligibility Match:</strong> ${eligibility.score}%</p>
                <p>Log in to your AthletIQ dashboard to apply immediately.</p>
              </div>`
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error during scheduled deadline check', { error: error.message });
  }
};

/**
 * Initializes cron jobs.
 */
export const initCronJobs = () => {
  // Run daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running daily scheduled opportunity deadline check...');
    await checkUpcomingDeadlines();
  });

  logger.info('Scheduled cron jobs initialized (Deadline Alert: 0 9 * * *)');
};
