/**
 * AthleteConnect — Full HTTP REST API Integration Test Runner
 * Starts an in-memory HTTP server and executes real HTTP requests
 * against all major API endpoints.
 */

import 'dotenv/config';
import http from 'node:http';
import { app, initApp } from './app.js';
import { connectDb, closeDb } from './config/db.js';

let server;
let baseUrl = '';

async function startTestServer() {
  await connectDb();
  initApp();
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`🚀 Test HTTP server running at ${baseUrl}`);
      resolve(port);
    });
  });
}

async function stopTestServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDb();
}

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message} ${detail ? `(${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message} ${detail ? `(${detail})` : ''}`);
  }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   AthleteConnect — Live HTTP REST API Test Suite     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    await startTestServer();

    // 1. Health Endpoint
    console.log('\n━━━ 1. System Health Check ━━━');
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/v1/health status 200', `Status: ${healthRes.status}`);
    assert(healthData.status === 'ok', 'Health status field is "ok"');

    // 2. Register Athlete
    console.log('\n━━━ 2. Athlete Auth & Registration ━━━');
    const uniqueEmail = `test.athlete.${Date.now()}@sports.in`;
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register/athlete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!',
        firstName: 'Sumit',
        lastName: 'Antil',
        dateOfBirth: '1998-07-06',
        gender: 'Male',
        sport: ['Athletics', 'Javelin'],
        city: 'Sonipat',
        state: 'Haryana',
        country: 'India'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, 'POST /api/v1/auth/register/athlete status 201', `Status: ${regRes.status}`);
    assert(regData.success === true && !!regData.data.token, 'Registration returns JWT token');

    const athleteToken = regData.data.token;
    const athleteId = regData.data.athlete.athleteId;

    // 3. Login
    console.log('\n━━━ 3. User Login Authentication ━━━');
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!',
        userType: 'athlete'
      })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200, 'POST /api/v1/auth/login status 200');
    assert(loginData.data.user.email === uniqueEmail, 'Login returns matching user record');

    // 4. Current User (/me)
    console.log('\n━━━ 4. Current Authenticated User Profile ━━━');
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, 'GET /api/v1/auth/me status 200');
    assert(meData.data.email === uniqueEmail, 'Profile matches authenticated user email');

    // 5. Matched Opportunities
    console.log('\n━━━ 5. AI Matched Opportunities ━━━');
    const matchRes = await fetch(`${baseUrl}/api/v1/opportunities/matched`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const matchData = await matchRes.json();
    assert(matchRes.status === 200, 'GET /api/v1/opportunities/matched status 200');
    assert(Array.isArray(matchData.data), 'Matched opportunities returned as Array');

    // 6. Matched Jobs
    console.log('\n━━━ 6. AI Matched Jobs ━━━');
    const jobsRes = await fetch(`${baseUrl}/api/v1/jobs/matched`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const jobsData = await jobsRes.json();
    assert(jobsRes.status === 200, 'GET /api/v1/jobs/matched status 200');
    assert(Array.isArray(jobsData.data), 'Matched jobs returned as Array');

    // 7. Matched Sponsorships
    console.log('\n━━━ 7. AI Matched Sponsorships ━━━');
    const sponRes = await fetch(`${baseUrl}/api/v1/sponsorships/matched`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const sponData = await sponRes.json();
    assert(sponRes.status === 200, 'GET /api/v1/sponsorships/matched status 200');
    assert(Array.isArray(sponData.data), 'Matched sponsorships returned as Array');

    // 8. Notifications
    console.log('\n━━━ 8. In-App Notifications API ━━━');
    const notifRes = await fetch(`${baseUrl}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const notifData = await notifRes.json();
    assert(notifRes.status === 200, 'GET /api/v1/notifications status 200');
    assert(Array.isArray(notifData.data.notifications), 'Notifications list returned as Array');

    // 9. File Upload Test (Uploads to ./uploads folder)
    console.log('\n━━━ 9. Media & File Upload API ━━━');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const sampleFileContent = 'PDF-Sample-Certificate-Mock-Data-2026';
    const postBody = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="test_certificate.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n` +
      sampleFileContent + `\r\n` +
      `--${boundary}--\r\n`;

    const uploadRes = await fetch(`${baseUrl}/api/v1/upload/file`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: postBody
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.status === 201, 'POST /api/v1/upload/file status 201', `Status: ${uploadRes.status}`);
    assert(uploadData.success === true && !!uploadData.data.fileUrl, 'File upload returns valid fileUrl', `URL: ${uploadData.data?.fileUrl}`);

    // 10. Unauthorized Route Rejection
    console.log('\n━━━ 10. Security & Auth Guard Verification ━━━');
    const unauthRes = await fetch(`${baseUrl}/api/v1/opportunities/matched`);
    assert(unauthRes.status === 401, 'Unauthenticated request correctly rejected with status 401');

    // 11. Dual-Token Refresh
    console.log('\n━━━ 11. Refresh Token Flow ━━━');
    const athleteRefreshToken = regData.data.refreshToken;
    const refreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: athleteRefreshToken })
    });
    const refreshData = await refreshRes.json();
    assert(refreshRes.status === 200, 'POST /api/v1/auth/refresh status 200');
    assert(!!refreshData.data?.token, 'Refreshed access token successfully issued');

    // 12. Manual Training Session Entry & History
    console.log('\n━━━ 12. Training Session Logging & Retrieval ━━━');
    const sessionRes = await fetch(`${baseUrl}/api/v1/training`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        activity: 'Running',
        duration: 45,
        distance: 7.5,
        calories: 520,
        heartRate: 158,
        intensity: 'High'
      })
    });
    const sessionData = await sessionRes.json();
    assert(sessionRes.status === 201, 'POST /api/v1/training status 201 (Session Logged)');
    assert(sessionData.data?.activity === 'Running', 'Training session persisted with activity Running');

    const getSessionsRes = await fetch(`${baseUrl}/api/v1/training`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const getSessionsData = await getSessionsRes.json();
    assert(getSessionsRes.status === 200, 'GET /api/v1/training status 200');
    assert(getSessionsData.count >= 1, 'Logged sessions retrieved from database');

    // 13. Training Dashboard (6 Metrics)
    console.log('\n━━━ 13. Training Dashboard Metrics ━━━');
    const dashRes = await fetch(`${baseUrl}/api/v1/training/dashboard`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200, 'GET /api/v1/training/dashboard status 200');
    assert(dashData.data?.metrics?.weeklyDistanceKm !== undefined, 'Dashboard returns weeklyDistanceKm');
    assert(dashData.data?.metrics?.trainingSessionsPerWeek !== undefined, 'Dashboard returns trainingSessionsPerWeek');
    assert(dashData.data?.metrics?.recoveryPercentage !== undefined, 'Dashboard returns recoveryPercentage');

    // 14. Recovery Intelligence
    console.log('\n━━━ 14. Recovery Intelligence Module ━━━');
    const recRes = await fetch(`${baseUrl}/api/v1/training/recovery`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const recData = await recRes.json();
    assert(recRes.status === 200, 'GET /api/v1/training/recovery status 200');
    assert(recData.data?.recoveryDayRecommended !== undefined, 'Recovery analysis returns recoveryDayRecommended flag');
    assert(!!recData.data?.recommendations?.mobilitySuggestion, 'Recovery analysis provides mobility suggestions');

    // 15. Training Plan Generation & Persistence
    console.log('\n━━━ 15. AI Training Plan Generation & Persistence ━━━');
    const planRes = await fetch(`${baseUrl}/api/v1/training/plan`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sport: 'Athletics',
        goal: 'Speed and 100m sprint endurance',
        age: 24,
        weight: 74,
        height: 182
      })
    });
    const planData = await planRes.json();
    assert(planRes.status === 200, 'POST /api/v1/training/plan status 200');
    assert(planData.data?.weeklySchedule?.length === 7, 'Weekly schedule contains 7 days');

    // 16. Exercise Form Correction
    console.log('\n━━━ 16. Exercise Form Correction & Analysis ━━━');
    const exerciseRes = await fetch(`${baseUrl}/api/v1/exercise/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        exerciseName: 'Squats',
        reps: 10
      })
    });
    const exerciseData = await exerciseRes.json();
    assert(exerciseRes.status === 200, 'POST /api/v1/exercise/analyze status 200');
    assert(!!exerciseData.data?.correctionReport?.cvMetrics, 'Exercise analysis returns CV joint angles metrics');

    // 17. Dynamic Performance Stats
    console.log('\n━━━ 17. Sport-Specific Performance Stats ━━━');
    const statRes = await fetch(`${baseUrl}/api/v1/athletes/stats`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sport: 'Athletics',
        statName: '100m Time',
        statValue: 10.85,
        unit: 'seconds'
      })
    });
    const statData = await statRes.json();
    assert(statRes.status === 201, 'POST /api/v1/athletes/stats status 201');

    const getStatsRes = await fetch(`${baseUrl}/api/v1/athletes/stats?sport=Athletics`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const getStatsData = await getStatsRes.json();
    assert(getStatsRes.status === 200, 'GET /api/v1/athletes/stats status 200');
    assert(getStatsData.count >= 1, 'Dynamic sport performance stats fetched');

    // 18. Canonical Athlete Profile Endpoints
    console.log('\n━━━ 18. Canonical Athlete Profile Endpoints ━━━');
    const getProfileRes = await fetch(`${baseUrl}/api/v1/athletes/profile`, {
      headers: { Authorization: `Bearer ${athleteToken}` }
    });
    const getProfileData = await getProfileRes.json();
    assert(getProfileRes.status === 200, 'GET /api/v1/athletes/profile status 200');
    assert(getProfileData.data?.email === uniqueEmail, 'Canonical profile matches current user');

    // 19. User Abuse Reporting
    console.log('\n━━━ 19. Abuse Reporting Endpoint ━━━');
    const reportRes = await fetch(`${baseUrl}/api/v1/reports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${athleteToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetType: 'opportunity',
        targetId: 'opp_sample_123',
        reason: 'Spam',
        description: 'Testing user abuse report filing'
      })
    });
    const reportData = await reportRes.json();
    assert(reportRes.status === 201, 'POST /api/v1/reports status 201');
    assert(reportData.data?.status === 'PENDING', 'Report recorded with PENDING status');


    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║   HTTP API RESULTS: ${passed} PASSED, ${failed} FAILED                 ║`);
    if (failed === 0) {
      console.log('║   🎉 ALL HTTP REST API ENDPOINTS WORKING PERFECTLY!  ║');
    } else {
      console.log('║   ⚠️ SOME API ENDPOINT TESTS FAILED                 ║');
    }
    console.log('╚══════════════════════════════════════════════════════╝\n');

  } catch (err) {
    console.error('Error during test execution:', err);
    failed++;
  } finally {
    await stopTestServer();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
