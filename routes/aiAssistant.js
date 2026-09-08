import { Router } from 'express';
import * as aiAssistantController from '../controllers/aiAssistantController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Feature 7: Multi-Agent AI Assistant Chat
router.post('/chat', aiAssistantController.chat);

// Get chat history
router.get('/history', aiAssistantController.getChatHistory);

export default router;

