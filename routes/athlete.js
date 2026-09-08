import { Router } from 'express';
import * as athleteController from '../controllers/athleteController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);

// Section 20 Master Spec: Canonical Athlete Profile Endpoints
// These are athlete-only self-service actions — no :id param means the
// target is implicitly req.user.id, so without this guard any authenticated
// role (organization, admin) could write into these athlete-only endpoints
// using their own account id as the target.
router.get('/profile', authorize(ROLES.ATHLETE), athleteController.getMyProfile);
router.put('/profile', authorize(ROLES.ATHLETE), athleteController.updateMyProfile);

// Section 2 & 19: Sport-Specific Performance Stats
router.post('/stats', authorize(ROLES.ATHLETE), athleteController.addPerformanceStat);
router.get('/stats', authorize(ROLES.ATHLETE), athleteController.getPerformanceStats);
router.post('/:id/stats', authorize(ROLES.ATHLETE, ROLES.ADMIN), athleteController.addPerformanceStat);
router.get('/:id/stats', athleteController.getPerformanceStats);

// Achievements
router.post('/achievements', authorize(ROLES.ATHLETE), athleteController.addAchievement);
router.post('/:id/achievements', authorize(ROLES.ATHLETE, ROLES.ADMIN), athleteController.addAchievement);
router.delete('/:id/achievements/:achId', authorize(ROLES.ATHLETE, ROLES.ADMIN), athleteController.removeAchievement);

// Profile By ID & Dashboard — readable by any authenticated role (orgs
// browsing athletes, admins moderating); privacy filtering happens inside
// the controller. Only the writes below are athlete/admin-restricted.
router.get('/:id', athleteController.getProfile);
router.patch('/:id', authorize(ROLES.ATHLETE, ROLES.ADMIN), athleteController.updateProfile);
router.get('/:id/dashboard', authorize(ROLES.ATHLETE, ROLES.ADMIN), athleteController.getDashboard);

export default router;

