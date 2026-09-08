import { z } from 'zod';
import { ValidationError } from './errorHandler.js';

/**
 * Express middleware that validates request data against a Zod schema.
 *
 * @param {z.ZodSchema} schema - The Zod schema to validate against.
 * @param {'body' | 'query' | 'params'} [source='body'] - The property of req to validate.
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        return next(new ValidationError(`Validation error: ${errorMessages}`));
      }
      next(error);
    }
  };
};

// Common reusable Zod schemas
export const schemas = {
  registerAthlete: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().or(z.date()),
    gender: z.string().optional(),
    sport: z.string().or(z.array(z.string())).optional()
  }).passthrough(),

  registerOrg: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    name: z.string().min(1, 'Organization name is required'),
    type: z.string().min(1, 'Organization type is required')
  }).passthrough(),

  login: z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required'),
    userType: z.string().optional()
  }).passthrough(),

  trainingSession: z.object({
    activity: z.string().min(1, 'Activity name is required'),
    duration: z.number().min(1, 'Duration must be greater than 0').optional().or(z.string()),
    distance: z.number().min(0).optional().or(z.string()),
    calories: z.number().min(0).optional().or(z.string()),
    heartRate: z.number().min(0).optional().or(z.string()),
    intensity: z.string().optional()
  }).passthrough(),

  opportunity: z.object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    sport: z.string().or(z.array(z.string())).optional(),
    deadline: z.string().or(z.date()).optional()
  }).passthrough()
};
