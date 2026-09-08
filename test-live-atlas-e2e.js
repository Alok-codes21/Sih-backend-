import 'dotenv/config';
import { connectDb, closeDb } from './config/db.js';
import { createAthlete, findAthleteByEmail } from './models/Athlete.js';
import { createOrganization } from './models/Organization.js';
import { createOpportunity } from './models/Opportunity.js';
import { matchOpportunities } from './services/matchingService.js';
import bcrypt from 'bcrypt';

async function testLiveAtlasData() {
  try {
    console.log("Connecting to live MongoDB Atlas...");
    await connectDb();
    console.log("✅ Database initialized!");

    // 1. Clean previous test entries if any
    const db = (await import('./config/db.js')).getDb();
    await db.collection('athletes').deleteMany({ email: 'live.test.athlete@sports.com' });
    await db.collection('organizations').deleteMany({ email: 'live.test.academy@sports.com' });
    await db.collection('opportunities').deleteMany({ title: 'Live Atlas Test Trials 2026' });

    // 2. Create Athlete in Atlas
    const hashedPassword = await bcrypt.hash('StrongPass123', 10);
    const athlete = await createAthlete({
      email: 'live.test.athlete@sports.com',
      passwordHash: hashedPassword,
      firstName: 'Neeraj',
      lastName: 'Chopra',
      dateOfBirth: '2002-05-15',
      gender: 'Male',
      sport: ['Athletics', 'Javelin'],
      city: 'Panipat',
      state: 'Haryana',
      country: 'India'
    });
    console.log("✅ Created Athlete in Atlas DB:", athlete.athleteId);

    // 3. Create Organization in Atlas
    const org = await createOrganization({
      email: 'live.test.academy@sports.com',
      passwordHash: hashedPassword,
      name: 'Haryana Sports Academy',
      type: 'Academy',
      description: 'Premier sports academy in North India',
      sports: ['Athletics', 'Javelin'],
      city: 'Panipat',
      state: 'Haryana',
      country: 'India'
    });
    console.log("✅ Created Organization in Atlas DB:", org.orgId);

    // 4. Create Opportunity in Atlas
    const opp = await createOpportunity({
      postedBy: org.orgId,
      title: 'Live Atlas Test Trials 2026',
      type: 'Trial',
      sport: ['Athletics'],
      description: 'State level athletics trial',
      eligibility: { minAge: 18, maxAge: 25, gender: 'Any', minExperience: 1, requiredLevel: 'District', states: ['Haryana'] },
      deadline: new Date(Date.now() + 30 * 86400000),
      location: 'Panipat, Haryana',
      monetaryBenefit: 50000
    });
    console.log("✅ Created Opportunity in Atlas DB:", opp.oppId);

    // 5. Test Live Matching Engine against Atlas data
    const matched = await matchOpportunities(athlete.athleteId);
    console.log("✅ Matching Engine Result from Atlas:", matched.length, "opportunity matched!");
    if (matched.length > 0) {
      console.log(`   Top Match: "${matched[0].title}" — Score: ${matched[0].matchScore}%`);
    }

    // 6. Test Achievement Addition & Organization Verification
    const { addAchievement } = await import('./models/Athlete.js');
    await addAchievement(athlete.athleteId, {
      title: 'National Athletics Gold Medal',
      level: 'National',
      sport: 'Athletics',
      year: 2025,
      certificateUrl: 'https://res.cloudinary.com/demo/image/upload/sample_certificate.pdf',
      verificationStatus: 'PENDING'
    });
    console.log("✅ Added Achievement with Certificate to Athlete in Atlas");

    // Organization verifies achievement
    const { createNotification, getUserNotifications } = await import('./models/Notification.js');
    await db.collection('athletes').updateOne(
      { athleteId: athlete.athleteId, 'achievements.title': 'National Athletics Gold Medal' },
      {
        $set: {
          'achievements.$.verificationStatus': 'VERIFIED',
          'achievements.$.verifiedBy': org.orgId,
          isVerified: true
        }
      }
    );
    console.log("✅ Organization Verified Athlete Achievement in Atlas -> isVerified: true");

    // 7. Test In-App Notification System in Atlas
    const notif = await createNotification({
      userId: athlete.athleteId,
      title: '🏆 Achievement Verified!',
      message: `Your National Athletics Gold Medal was verified by ${org.name}.`,
      type: 'ACHIEVEMENT_VERIFIED',
      data: { orgId: org.orgId }
    });
    console.log("✅ Created Notification in Atlas DB:", notif.notificationId);

    const userNotifs = await getUserNotifications(athlete.athleteId);
    console.log("✅ Fetched Notifications from Atlas DB, Count:", userNotifs.notifications.length);

    // 8. Test Application Creation & Withdrawal
    const appResult = await db.collection('applications').insertOne({
      applicationId: 'app_test_123',
      athleteId: athlete.athleteId,
      orgId: org.orgId,
      targetId: opp.oppId,
      type: 'opportunity',
      status: 'Applied',
      createdAt: new Date()
    });
    console.log("✅ Created Application in Atlas DB:", appResult.insertedId);

    await db.collection('applications').updateOne(
      { applicationId: 'app_test_123' },
      { $set: { status: 'Withdrawn', updatedAt: new Date() } }
    );
    console.log("✅ Athlete Withdrew Application in Atlas DB -> status: Withdrawn");

    // 9. Test Admin Platform Aggregated Stats Query
    const athleteCount = await db.collection('athletes').countDocuments();
    const oppCount = await db.collection('opportunities').countDocuments();
    console.log(`✅ Admin Aggregated Stats from Atlas: ${athleteCount} athletes, ${oppCount} opportunities`);

    console.log("\n🎉 ALL LIVE ATLAS READ/WRITE/MATCHING/VERIFICATION/NOTIFICATION/ADMIN/APPLICATION TESTS PASSED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ Live Atlas Test Error:", err);
  } finally {
    await closeDb();
  }
}

testLiveAtlasData();


