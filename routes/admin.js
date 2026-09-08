import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import * as orgController from '../controllers/orgController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

// Protect all admin routes with authentication and ADMIN role check
router.use(authenticate);
router.use(authorize(ROLES.ADMIN));

// Platform metrics
router.get('/stats', adminController.getPlatformStats);

// User governance
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);

// Organization verification
router.patch('/organizations/:orgId/verify', adminController.verifyOrganization);

// Athlete achievement verification
router.patch('/verify-achievement/:athleteId/:achId', orgController.verifyAchievement);

// Opportunity moderation
router.patch('/opportunities/:oppId/moderate', adminController.moderateOpportunity);

// Section 17: Reports & Abuse Moderation
router.get('/reports', adminController.getReports);
router.post('/reports', adminController.fileReport);
router.patch('/reports/:reportId', adminController.moderateReportHandler);

// Section 17: Sports Category Taxonomy Management
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.delete('/categories/:id', adminController.deleteCategory);

export default router;

