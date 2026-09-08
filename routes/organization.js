import { Router } from 'express';
import * as orgController from '../controllers/orgController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);

// Section 16 & Section 6: Reverse Athlete Matching / Search & Filter
router.post('/athletes/search', authorize(ROLES.ORGANIZATION, ROLES.ADMIN), orgController.searchAthletes);
router.get('/athletes/search', authorize(ROLES.ORGANIZATION, ROLES.ADMIN), orgController.searchAthletes);

// Profile
router.get('/:id', orgController.getProfile);
router.patch('/:id', authorize(ROLES.ORGANIZATION), orgController.updateProfile);

// Section 16: Organization Analytics
router.get('/:id/analytics', authorize(ROLES.ORGANIZATION, ROLES.ADMIN), orgController.getOrgAnalytics);

// Applications
router.get('/:id/applications', authorize(ROLES.ORGANIZATION), orgController.getApplications);
router.patch('/applications/:id', authorize(ROLES.ORGANIZATION), orgController.updateApplicationStatus);

// Verification of athlete achievements by organization/academy or platform admin
router.patch('/verify-achievement/:athleteId/:achId', authorize(ROLES.ORGANIZATION, ROLES.ADMIN), orgController.verifyAchievement);

export default router;


