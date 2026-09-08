import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { createRateLimiter } from './middleware/rateLimiter.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { HTTP_STATUS } from './utils/constants.js';
import { logger } from './utils/logger.js';

// Import route files
import authRoutes from './routes/auth.js';
import athleteRoutes from './routes/athlete.js';
import jobRoutes from './routes/job.js';
import opportunityRoutes from './routes/opportunity.js';
import organizationRoutes from './routes/organization.js';
import sponsorshipRoutes from './routes/sponsorship.js';
import trainingRoutes from './routes/training.js';
import exerciseRoutes from './routes/exercise.js';
import aiAssistantRoutes from './routes/aiAssistant.js';
import uploadRoutes from './routes/upload.js';
import notificationRoutes from './routes/notification.js';
import adminRoutes from './routes/admin.js';
import applicationRoutes from './routes/application.js';
import reportRoutes from './routes/report.js';

export const app = express();


export const initApp = () => {
  // Trust proxy for correct client IP behind reverse proxy (Nginx, CloudFlare, etc.)
  app.set('trust proxy', 1);

  // Security headers
  app.use(helmet({
    crossOriginResourcePolicy: false // Allows serving media files to frontend
  }));

  // CORS — allow frontend ports and dev origins in development
  const devOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];
  const configuredOrigin = process.env.CORS_ORIGIN;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, same-origin/file)
        if (!origin) return callback(null, true);
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        if (configuredOrigin && origin === configuredOrigin) return callback(null, true);
        // Never allow development origins in production. Keep the whitelist
        // strictly environment-aware so a production deployment cannot
        // accidentally expose APIs to localhost dev clients.
        return callback(new Error('Blocked by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    })
  );

  // Parse JSON requests
  app.use(
    express.json({
      limit: '10mb'
    })
  );

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip
      });
    });
    next();
  });

  // Serve static uploads (local fallback)
  app.use('/uploads', express.static('uploads'));

  // Rate limiter
  const limiter = createRateLimiter();
  app.use(limiter);

  // Health check
  app.get('/api/v1/health', (req, res) => {
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      service: 'AthleteConnect Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // ── TEST DASHBOARD (development only) ──────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    app.use('/test-dashboard', express.static('public/test-dashboard'));
    app.get('/', (req, res) => res.redirect('/test-dashboard/'));
  }
  // ── END TEST DASHBOARD ──────────────────────────────────────────

  // Core routes (Features 1-3)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/athletes', athleteRoutes);
  app.use('/api/v1/organizations', organizationRoutes);
  app.use('/api/v1/opportunities', opportunityRoutes);
  app.use('/api/v1/jobs', jobRoutes);
  app.use('/api/v1/sponsorships', sponsorshipRoutes);

  // Applications lifecycle
  app.use('/api/v1/applications', applicationRoutes);

  // Feature 4-5: Training & Wearable Sync
  app.use('/api/v1/training', trainingRoutes);

  // Feature 6: Exercise Form Correction (Proxies to Python FastAPI with fallback)
  app.use('/api/v1/exercise', exerciseRoutes);

  // Feature 7: AI Assistant (Proxies to Python FastAPI with fallback)
  app.use('/api/v1/ai-assistant', aiAssistantRoutes);

  // Media & File Uploads (Cloudinary + Local fallback)
  app.use('/api/v1/upload', uploadRoutes);

  // In-App Notifications
  app.use('/api/v1/notifications', notificationRoutes);

  // Admin Governance (Platform stats, moderation, verification)
  app.use('/api/v1/admin', adminRoutes);

  // User abuse/moderation reporting
  app.use('/api/v1/reports', reportRoutes);



  // 404 handler
  app.use((req, res) => {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      error: 'Route not found'
    });
  });

  // Global error handler (must be last)
  app.use(globalErrorHandler);
};

export const shutdownApp = async () => {
  logger.info('Express app shutdown completed');
};