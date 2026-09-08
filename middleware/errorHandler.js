import { HTTP_STATUS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, HTTP_STATUS.CONFLICT);
  }
}

/**
 * Global Express error handler.
 * Handles known operational errors, MongoDB duplicate key errors,
 * BSON/ObjectId cast errors, and JSON parse errors cleanly.
 */
export const globalErrorHandler = (err, req, res, next) => {
  // MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    logger.warn('Duplicate key error', { field, path: req.path });
    return res.status(HTTP_STATUS.CONFLICT).json({
      error: `A record with this ${field} already exists.`
    });
  }

  // BSON / ObjectId cast errors
  if (err.name === 'BSONError' || err.name === 'BSONTypeError' ||
      (err.message && err.message.includes('must be a string of 12 bytes or a string of 24 hex characters'))) {
    logger.warn('Invalid ID format', { message: err.message, path: req.path });
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Invalid ID format provided.'
    });
  }

  // JSON parse errors from malformed request body
  if (err.type === 'entity.parse.failed') {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: 'Malformed JSON in request body.'
    });
  }

  // Known operational errors (our custom AppError hierarchy)
  if (err.isOperational) {
    logger.warn('Operational Error', { message: err.message, statusCode: err.statusCode, path: req.path });
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Unknown / unexpected errors
  logger.error('Unexpected Error', { error: err.message, stack: err.stack, path: req.path });
  res.status(HTTP_STATUS.SERVER_ERROR).json({ error: 'Internal Server Error' });
};
