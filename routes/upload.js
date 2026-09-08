import { Router } from 'express';
import { handleFileUpload } from '../controllers/uploadController.js';
import { uploadMedia } from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Allow authenticated users to upload files
router.post('/file', authenticate, uploadMedia, handleFileUpload);

export default router;
