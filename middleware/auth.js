import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from './errorHandler.js';
import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return secret;
};

const getRefreshSecret = () => {
  return process.env.JWT_REFRESH_SECRET || (getSecret() + '_refresh');
};

/**
 * Generates an Access Token with the given payload.
 *
 * @param {Object} payload - Must include at least { id } or { userId }.
 * @param {string|number} [expiresIn] - Expiry string or seconds (default: JWT_EXPIRY or '24h').
 * @returns {string} The JWT access token.
 */
export const generateToken = (payload, expiresIn) => {
  const secret = getSecret();
  const userType = (payload.userType || payload.role || 'athlete').toLowerCase();
  const userId = payload.id || payload.userId;

  const expiry = expiresIn || `${process.env.JWT_EXPIRY || '24'}h`;

  const tokenPayload = {
    id: userId,
    userId,
    email: payload.email,
    userType,
    role: userType,
    status: payload.status || 'ACTIVE'
  };

  return jwt.sign(tokenPayload, secret, { expiresIn: expiry });
};

export const generateAccessToken = generateToken;

/**
 * Generates a long-lived Refresh Token.
 *
 * @param {Object} payload
 * @returns {string} The JWT refresh token.
 */
export const generateRefreshToken = (payload) => {
  const secret = getRefreshSecret();
  const userType = (payload.userType || payload.role || 'athlete').toLowerCase();
  const userId = payload.id || payload.userId;

  const tokenPayload = {
    id: userId,
    userId,
    email: payload.email,
    userType,
    role: userType,
    status: payload.status || 'ACTIVE',
    type: 'refresh'
  };

  return jwt.sign(tokenPayload, secret, { expiresIn: '7d' });
};

/**
 * Verifies a JWT access token and returns the decoded payload.
 *
 * @param {string} token
 * @returns {Object} The decoded payload.
 */
export const verifyToken = (token) => {
  try {
    const secret = getSecret();
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token expired');
    }
    throw new AuthenticationError('Invalid token: ' + error.message);
  }
};

/**
 * Verifies a refresh token.
 *
 * @param {string} token
 * @returns {Object}
 */
export const verifyRefreshToken = (token) => {
  try {
    const secret = getRefreshSecret();
    const decoded = jwt.verify(token, secret);
    if (decoded.type !== 'refresh') {
      throw new AuthenticationError('Invalid refresh token type');
    }
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Refresh token expired');
    }
    throw new AuthenticationError('Invalid refresh token');
  }
};

/**
 * Express middleware that authenticates a request via Bearer token.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }
    const token = authHeader.split(' ')[1];
    req.user = verifyToken(token);

    // JWTs are intentionally stateless, but account status is mutable.
    // Re-read the current account status so an admin suspension/deactivation
    // takes effect immediately instead of waiting for the access token to expire.
    const userType = (req.user?.userType || req.user?.role || '').toLowerCase();
    const collectionByRole = { athlete: 'athletes', organization: 'organizations', admin: 'admins' };
    const idFieldByRole = { athlete: 'athleteId', organization: 'orgId', admin: 'adminId' };
    const collectionName = collectionByRole[userType];
    const idField = idFieldByRole[userType];

    if (collectionName && idField) {
      const id = req.user.id || req.user.userId;
      const conditions = [{ [idField]: id }];
      if (ObjectId.isValid(id)) conditions.push({ _id: new ObjectId(id) });
      const account = await getDb().collection(collectionName).findOne({ $or: conditions }, { projection: { status: 1 } });

      if (account?.status && ['SUSPENDED', 'DEACTIVATED'].includes(String(account.status).toUpperCase())) {
        throw new AuthorizationError(`Account is ${String(account.status).toLowerCase()}. Contact support.`);
      }
    }

    next();
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return next(error);
    }
    next(new AuthenticationError(error.message));
  }
};

/**
 * Express middleware that authorizes by user type.
 * Normalizes input so case-insensitive matching works (e.g. 'ADMIN' matches 'admin').
 *
 * @param  {...string} allowedTypes
 */
export const authorize = (...allowedTypes) => {
  const normalizedAllowed = allowedTypes.map(t => t.toLowerCase());
  return (req, res, next) => {
    const rawType = req.user?.userType || req.user?.role;
    if (!rawType) {
      return next(new AuthenticationError('User type not found in token'));
    }
    const userType = rawType.toLowerCase();
    if (!normalizedAllowed.includes(userType)) {
      return next(new AuthorizationError(`User type '${rawType}' not authorized for this resource`));
    }
    next();
  };
};

