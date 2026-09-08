import { Router } from 'express';
import * as opportunityController from '../controllers/opportunityController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { ROLES } from '../utils/constants.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize(ROLES.ORGANIZATION), validate(schemas.opportunity), opportunityController.create);
router.get('/', opportunityController.getAll);
router.get('/matched', authorize(ROLES.ATHLETE), opportunityController.getMatched);
router.get('/:id', opportunityController.getById);
router.post('/:id/apply', authorize(ROLES.ATHLETE), opportunityController.apply);

export default router;
