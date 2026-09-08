import { Router } from 'express';
import * as exerciseController from '../controllers/exerciseController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);

// Feature 6: Get exercise form reference database — general reference info,
// safe for any authenticated role to read.
router.get('/database', exerciseController.getExerciseDatabase);

// Analyze/history are self-service actions keyed off req.user.id, so they're
// athlete-only — otherwise an organization or admin account could write into
// exercise_history using their own non-athlete id.
router.post('/analyze', authorize(ROLES.ATHLETE), exerciseController.analyzeExercise);
router.get('/history', authorize(ROLES.ATHLETE), exerciseController.getExerciseHistory);

export default router;

