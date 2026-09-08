import * as authService from '../services/authService.js';
import { logger } from '../utils/logger.js';

export const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const registerAthlete = async (req, res, next) => {
  try {
    const { athlete, token, refreshToken } = await authService.registerAthlete(req.body);
    res.status(201).json({ success: true, data: { athlete, token, refreshToken } });
  } catch (error) {
    next(error);
  }
};

export const registerOrganization = async (req, res, next) => {
  try {
    const { organization, token, refreshToken } = await authService.registerOrganization(req.body);
    res.status(201).json({ success: true, data: { organization, token, refreshToken } });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { user, token, refreshToken } = await authService.login(req.body);
    res.status(200).json({ success: true, data: { user, token, refreshToken } });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    const result = await authService.logout(refreshToken);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const result = await authService.forgotPassword(req.body.email);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const { id, userType } = req.user;
    const db = (await import('../config/db.js')).getDb();
    const { ObjectId } = await import('mongodb');

    let collectionName = 'athletes';
    let idField = 'athleteId';
    if (userType === 'organization') {
      collectionName = 'organizations';
      idField = 'orgId';
    } else if (userType === 'admin') {
      collectionName = 'admins';
      idField = 'adminId';
    }

    const query = { $or: [{ [idField]: id }] };
    try { query.$or.push({ _id: new ObjectId(id) }); } catch (e) {}

    const user = await db.collection(collectionName).findOne(query);
    if (!user) {
      return res.status(200).json({ success: true, data: { ...req.user } });
    }

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    res.status(200).json({ success: true, data: safeUser });
  } catch (error) {
    next(error);
  }
};


