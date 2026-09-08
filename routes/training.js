import { Router } from 'express';
import * as trainingController from '../controllers/trainingController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);
// Every endpoint below is a pure self-service action keyed off req.user.id
// (no :id param), so it's athlete-only — otherwise an organization or admin
// account could write into training_sessions/training_plans using their own
// non-athlete id as the athleteId.
router.use(authorize(ROLES.ATHLETE));

// Section 9: Manual Workout Entry & History
router.post('/', validate(schemas.trainingSession), trainingController.createSession);
router.get('/', trainingController.getSessions);

// Wearable Sync
router.post('/sync', trainingController.syncTrainingData);

// Training Plans
router.post('/plan', trainingController.generateTrainingPlan);
router.get('/plan', trainingController.getActiveTrainingPlan);

// Section 9: Training Dashboard (6 Metrics)
router.get('/dashboard', trainingController.getDashboardMetrics);

// Section 10: Recovery Intelligence (3+ consecutive high-load detection & suggestions)
router.get('/recovery', trainingController.getRecoveryStatus);

// Section 12: Internal Summary API for AI Agent Layer
router.get('/summary', trainingController.getTrainingSummary);

export default router;

