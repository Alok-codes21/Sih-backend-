import { Router } from 'express';
import * as sponsorshipController from '../controllers/sponsorshipController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(ROLES.ORGANIZATION), sponsorshipController.create);
router.get('/', sponsorshipController.getAll);
router.get('/matched', authorize(ROLES.ATHLETE), sponsorshipController.getMatched);
router.get('/:id', sponsorshipController.getById);
router.post('/:id/apply', authorize(ROLES.ATHLETE), sponsorshipController.apply);

export default router;
