import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import { authRateLimiter, loginRateLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Registration (stricter rate limit: 10 req/min)
router.post('/register', authRateLimiter, authController.register);
router.post('/register/athlete', authRateLimiter, validate(schemas.registerAthlete), authController.registerAthlete);
router.post('/register/organization', authRateLimiter, validate(schemas.registerOrg), authController.registerOrganization);

// Authentication & Token Lifecycle (login: 5 req/min)
router.post('/login', loginRateLimiter, validate(schemas.login), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Password Management (strictest: 3 req/min)
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

// Profile
router.get('/me', authenticate, authController.getCurrentUser);

export default router;


