/**
 * AthleteConnect Backend - Unit & Integration Verification Script
 * Tests utils, auth, validators, matching engine, and import integrity.
 */
import 'dotenv/config';

import { USER_TYPES, SPORTS, MATCH_WEIGHTS, HTTP_STATUS, APPLICATION_STATUS } from './utils/constants.js';
import { logger } from './utils/logger.js';
import { validateEmail, validatePassword, validateRequired, calculateAge, calculateBMI, sanitizeString } from './utils/validators.js';
import { generateToken, verifyToken, generateRefreshToken, verifyRefreshToken } from './middleware/auth.js';

import { matchOpportunities, matchJobs, matchSponsorships } from './services/matchingService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✅ PASS: ${message}`);
    } else {
        failed++;
        console.error(`  ❌ FAIL: ${message}`);
    }
}

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   AthleteConnect — Backend Verification Report       ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

console.log('━━━ GROUP 1: Constants ━━━');
assert(USER_TYPES.ATHLETE === 'athlete', 'USER_TYPES has athlete');
assert(USER_TYPES.ORGANIZATION === 'organization', 'USER_TYPES has organization');
assert(SPORTS.includes('Cricket') && SPORTS.includes('Athletics'), 'SPORTS includes core sports');
assert(MATCH_WEIGHTS.SPORT === 25, 'Match weight SPORT is 25 (Master Spec 100% distribution)');
assert(
  Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0) === 100,
  'MATCH_WEIGHTS sums to exactly 100%'
);
assert(HTTP_STATUS.OK === 200 && HTTP_STATUS.CREATED === 201, 'HTTP_STATUS codes valid');

// 2. Validators
console.log('\n━━━ GROUP 2: Validators ━━━');
assert(validateEmail('test@athleteconnect.com') === true, 'validateEmail accepts valid email');
assert(validateEmail('invalid-email') === false, 'validateEmail rejects invalid email');
assert(validatePassword('StrongPass123').valid === true, 'validatePassword accepts strong password');
assert(validatePassword('weak').valid === false, 'validatePassword rejects weak password');
assert(calculateAge('2000-01-01') >= 24, 'calculateAge calculates age correctly');
assert(calculateBMI(180, 75) === 23.1, 'calculateBMI calculates BMI correctly (180cm, 75kg = 23.1)');

// 3. Logger & Auth JWT
console.log('\n━━━ GROUP 3: Logger & Auth JWT ━━━');
assert(typeof logger.info === 'function', 'logger has info method');
const testToken = generateToken({ id: 'test1234', userType: 'athlete' });
assert(typeof testToken === 'string' && testToken.split('.').length === 3, 'generateToken returns valid 3-part JWT');
const decoded = verifyToken(testToken);
assert(decoded && decoded.id === 'test1234', 'verifyToken correctly decodes payload');

const refreshToken = generateRefreshToken({ id: 'test1234', userType: 'athlete' });
assert(typeof refreshToken === 'string' && refreshToken.split('.').length === 3, 'generateRefreshToken returns valid JWT');
const decodedRefresh = verifyRefreshToken(refreshToken);
assert(decodedRefresh && decodedRefresh.id === 'test1234', 'verifyRefreshToken correctly decodes payload');

// 4. Matching Service Algorithm
console.log('\n━━━ GROUP 4: Matching Service Algorithm ━━━');
assert(typeof matchOpportunities === 'function', 'matchOpportunities function exists');
assert(typeof matchJobs === 'function', 'matchJobs function exists');
assert(typeof matchSponsorships === 'function', 'matchSponsorships function exists');

// 5. New Modules Integrity
console.log('\n━━━ GROUP 5: P0/P1/P2 Modules Integrity ━━━');
import { createNotification, getUserNotifications } from './models/Notification.js';
import { uploadMediaFile } from './services/cloudinaryService.js';

import { checkUpcomingDeadlines, initCronJobs } from './services/cronService.js';
import { getPlatformStats, getAllUsers, updateUserStatus, verifyOrganization, getReports, getCategories } from './controllers/adminController.js';
import { getMyApplications, withdrawApplication, updateStatus as updateAppStatus } from './controllers/applicationController.js';
import { getChatHistory } from './controllers/aiAssistantController.js';
import { getExerciseHistory } from './controllers/exerciseController.js';
import { createSession, getDashboardMetrics, getRecoveryStatus } from './controllers/trainingController.js';
import { searchAthletes } from './controllers/orgController.js';
import { recordAthleteStat, getAthleteStats } from './models/AthleteStats.js';
import { validate, schemas } from './middleware/validate.js';
import { isEmailConfigured, sendEmail } from './services/emailService.js';

assert(typeof createNotification === 'function', 'createNotification is exported');
assert(typeof getUserNotifications === 'function', 'getUserNotifications is exported');
assert(typeof uploadMediaFile === 'function', 'uploadMediaFile is exported');
assert(typeof checkUpcomingDeadlines === 'function', 'checkUpcomingDeadlines is exported');
assert(typeof initCronJobs === 'function', 'initCronJobs is exported');
assert(typeof getPlatformStats === 'function', 'admin getPlatformStats is exported');
assert(typeof getAllUsers === 'function', 'admin getAllUsers is exported');
assert(typeof updateUserStatus === 'function', 'admin updateUserStatus is exported');
assert(typeof verifyOrganization === 'function', 'admin verifyOrganization is exported');
assert(typeof getReports === 'function', 'admin getReports is exported');
assert(typeof getCategories === 'function', 'admin getCategories is exported');
assert(typeof getMyApplications === 'function', 'application getMyApplications is exported');
assert(typeof withdrawApplication === 'function', 'application withdrawApplication is exported');
assert(typeof updateAppStatus === 'function', 'application updateStatus is exported');
assert(typeof getChatHistory === 'function', 'aiAssistant getChatHistory is exported');
assert(typeof getExerciseHistory === 'function', 'exercise getExerciseHistory is exported');
assert(typeof createSession === 'function', 'training createSession is exported');
assert(typeof getDashboardMetrics === 'function', 'training getDashboardMetrics is exported');
assert(typeof getRecoveryStatus === 'function', 'training getRecoveryStatus is exported');
assert(typeof searchAthletes === 'function', 'org searchAthletes is exported');
assert(typeof recordAthleteStat === 'function', 'athleteStats recordAthleteStat is exported');
assert(typeof getAthleteStats === 'function', 'athleteStats getAthleteStats is exported');
assert(typeof validate === 'function', 'validate middleware is exported');
assert(typeof schemas.trainingSession === 'object', 'schemas.trainingSession is exported');
assert(typeof isEmailConfigured === 'function', 'isEmailConfigured is exported');
assert(typeof sendEmail === 'function', 'sendEmail is exported');

// Summary
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log(`║   RESULTS: ${passed} PASSED, ${failed} FAILED                          ║`);
if (failed === 0) {
    console.log('║   🎉 ALL ATHLETECONNECT TESTS PASSED!               ║');
} else {
    console.log('║   ⚠️ SOME TESTS FAILED                              ║');
}
console.log('╚══════════════════════════════════════════════════════╝\n');

process.exit(failed > 0 ? 1 : 0);
