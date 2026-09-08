import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { fileReport } from '../controllers/adminController.js';

const router = Router();

router.use(authenticate);

// Authenticated users can file a report
router.post('/', fileReport);

export default router;
