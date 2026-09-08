import { Router } from 'express';
import * as jobController from '../controllers/jobController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(ROLES.ORGANIZATION), jobController.create);
router.get('/', jobController.getAll);
router.get('/matched', authorize(ROLES.ATHLETE), jobController.getMatched);
router.get('/:id', jobController.getById);
router.post('/:id/apply', authorize(ROLES.ATHLETE), jobController.apply);

export default router;
