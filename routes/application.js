import { Router } from 'express';
import * as applicationController from '../controllers/applicationController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);

// Athlete views own applications
router.get('/my-applications', authorize(ROLES.ATHLETE), applicationController.getMyApplications);

// Single application details
router.get('/:id', applicationController.getApplicationById);

// Athlete withdraws application
router.patch('/:id/withdraw', authorize(ROLES.ATHLETE), applicationController.withdrawApplication);

// Organization / Admin updates application status
router.patch('/:id/status', authorize(ROLES.ORGANIZATION, ROLES.ADMIN), applicationController.updateStatus);

export default router;
