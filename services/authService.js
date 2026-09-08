import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { ValidationError, ConflictError, AuthenticationError, AuthorizationError, NotFoundError } from '../middleware/errorHandler.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { validateEmail, validatePassword, validateRequired } from '../utils/validators.js';
import { ROLES } from '../utils/constants.js';

/**
 * Stores an issued refresh token in the database.
 */
const saveRefreshToken = async (userId, userType, refreshToken) => {
  try {
    const db = getDb();
    await db.collection('refresh_tokens').insertOne({
      userId: userId.toString(),
      userType,
      token: refreshToken,
      revoked: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
  } catch (err) {
    logger.warn('Failed to store refresh token', { error: err.message });
  }
};

/**
 * Registers a new athlete account.
 */
export const registerAthlete = async ({ email, password, firstName, lastName, dateOfBirth, gender, sport, city, state, country, ...extra }) => {
  const reqCheck = validateRequired({ email, password, firstName, lastName, dateOfBirth });
  if (!reqCheck.valid) throw new ValidationError(reqCheck.error);

  if (!validateEmail(email)) throw new ValidationError('Invalid email format');

  const pwdCheck = validatePassword(password);
  if (!pwdCheck.valid) throw new ValidationError(pwdCheck.error);

  const db = getDb();
  const existingUser = await db.collection('athletes').findOne({ email });
  if (existingUser) throw new ConflictError('Athlete with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);

  // Calculate age
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  let ageGroup = 'Adult';
  if (age < 13) ageGroup = 'Child';
  else if (age < 18) ageGroup = 'Teen';
  else if (age > 40) ageGroup = 'Veteran';

  const athleteId = crypto.randomUUID();

  const newAthlete = {
    athleteId,
    email,
    passwordHash,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    dateOfBirth: new Date(dateOfBirth),
    age,
    ageGroup,
    gender: gender || 'Not Specified',
    sport: Array.isArray(sport) ? sport : (sport ? [sport] : []),
    primarySport: extra.primarySport || (Array.isArray(sport) && sport[0]) || (typeof sport === 'string' ? sport : ''),
    secondarySport: extra.secondarySport || (Array.isArray(sport) && sport[1]) || '',
    position: extra.position || '',
    playingCategory: extra.playingCategory || '',
    experience: extra.experience || '',
    currentAcademy: extra.currentAcademy || '',
    currentInstitution: extra.currentInstitution || '',
    contactInformation: extra.contactInformation || extra.phone || '',
    profilePicture: extra.profilePicture || extra.avatarUrl || null,
    city: city || '',
    state: state || '',
    country: country || 'India',
    location: extra.location || `${city || ''}, ${state || ''}`.trim() || 'India',
    physicalStats: {
      height: extra.height || null,
      weight: extra.weight || null,
      bmi: extra.height && extra.weight ? parseFloat((extra.weight / Math.pow(extra.height / 100, 2)).toFixed(1)) : null
    },
    privacy: extra.privacy || { profile: 'public' },
    achievements: [],
    isVerified: false,
    userType: ROLES.ATHLETE,
    role: ROLES.ATHLETE,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('athletes').insertOne(newAthlete);
  const athlete = { _id: result.insertedId, ...newAthlete };
  delete athlete.passwordHash;

  const idStr = athlete._id.toString();
  const token = generateToken({ id: idStr, email, userType: ROLES.ATHLETE });
  const refreshToken = generateRefreshToken({ id: idStr, email, userType: ROLES.ATHLETE });
  await saveRefreshToken(idStr, ROLES.ATHLETE, refreshToken);

  logger.info(`Athlete registered: ${athlete._id}`);
  return { athlete, token, refreshToken };
};

/**
 * Registers a new organization account.
 */
export const registerOrganization = async ({ email, password, name, type, description, sports, city, state, country, ...extra }) => {
  const reqCheck = validateRequired({ email, password, name, type });
  if (!reqCheck.valid) throw new ValidationError(reqCheck.error);

  if (!validateEmail(email)) throw new ValidationError('Invalid email format');

  const pwdCheck = validatePassword(password);
  if (!pwdCheck.valid) throw new ValidationError(pwdCheck.error);

  const db = getDb();
  const existingOrg = await db.collection('organizations').findOne({ email });
  if (existingOrg) throw new ConflictError('Organization with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const orgId = crypto.randomUUID();

  const newOrg = {
    orgId,
    email,
    passwordHash,
    name,
    type,
    description: description || '',
    sports: Array.isArray(sports) ? sports : (sports ? [sports] : []),
    city: city || '',
    state: state || '',
    country: country || 'India',
    location: extra.location || `${city || ''}, ${state || ''}`.trim() || 'India',
    website: extra.website || '',
    phone: extra.phone || '',
    isVerified: false,
    userType: ROLES.ORGANIZATION,
    role: ROLES.ORGANIZATION,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('organizations').insertOne(newOrg);
  const organization = { _id: result.insertedId, ...newOrg };
  delete organization.passwordHash;

  const idStr = organization._id.toString();
  const token = generateToken({ id: idStr, email, userType: ROLES.ORGANIZATION });
  const refreshToken = generateRefreshToken({ id: idStr, email, userType: ROLES.ORGANIZATION });
  await saveRefreshToken(idStr, ROLES.ORGANIZATION, refreshToken);

  logger.info(`Organization registered: ${organization._id}`);
  return { organization, token, refreshToken };
};

/**
 * Registers an admin account (or creates initial superadmin).
 */
export const registerAdmin = async ({ email, password, name = 'Admin User' }) => {
  const reqCheck = validateRequired({ email, password });
  if (!reqCheck.valid) throw new ValidationError(reqCheck.error);

  if (!validateEmail(email)) throw new ValidationError('Invalid email format');

  const pwdCheck = validatePassword(password);
  if (!pwdCheck.valid) throw new ValidationError(pwdCheck.error);

  const db = getDb();
  const existing = await db.collection('admins').findOne({ email });
  if (existing) throw new ConflictError('Admin with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const adminId = crypto.randomUUID();

  const newAdmin = {
    adminId,
    email,
    passwordHash,
    name,
    role: ROLES.ADMIN,
    userType: ROLES.ADMIN,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('admins').insertOne(newAdmin);
  const admin = { _id: result.insertedId, ...newAdmin };
  delete admin.passwordHash;

  const idStr = admin._id.toString();
  const token = generateToken({ id: idStr, email, userType: ROLES.ADMIN });
  const refreshToken = generateRefreshToken({ id: idStr, email, userType: ROLES.ADMIN });
  await saveRefreshToken(idStr, ROLES.ADMIN, refreshToken);

  logger.info(`Admin registered: ${admin._id}`);
  return { user: admin, token, refreshToken };
};

/**
 * Unified registration router by role.
 */
export const registerUser = async (data) => {
  const role = (data.role || data.userType || 'athlete').toLowerCase();
  if (role === 'admin') {
    throw new AuthorizationError('Public registration for administrator accounts is prohibited');
  }
  if (role === 'organization') return registerOrganization(data);
  return registerAthlete(data);
};

/**
 * Logs in a user (athlete, organization, or admin).
 * Auto-detects collection if userType is omitted.
 */
export const login = async ({ email, password, userType }) => {
  if (!email || !password) throw new ValidationError('Email and password are required');

  const db = getDb();
  let user = null;
  let detectedType = userType ? userType.toLowerCase() : null;

  if (detectedType === ROLES.ATHLETE) {
    user = await db.collection('athletes').findOne({ email });
  } else if (detectedType === ROLES.ORGANIZATION) {
    user = await db.collection('organizations').findOne({ email });
  } else if (detectedType === ROLES.ADMIN) {
    user = await db.collection('admins').findOne({ email });
  } else {
    // Auto-detect role across collections
    user = await db.collection('athletes').findOne({ email });
    if (user) detectedType = ROLES.ATHLETE;
    if (!user) {
      user = await db.collection('organizations').findOne({ email });
      if (user) detectedType = ROLES.ORGANIZATION;
    }
    if (!user) {
      user = await db.collection('admins').findOne({ email });
      if (user) detectedType = ROLES.ADMIN;
    }
  }

  if (!user) throw new AuthenticationError('Invalid credentials');

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw new AuthenticationError('Invalid credentials');

  const finalUserType = (user.userType || user.role || detectedType || ROLES.ATHLETE).toLowerCase();
  const idStr = user._id.toString();

  const token = generateToken({
    id: idStr,
    userId: idStr,
    email: user.email,
    userType: finalUserType,
    role: finalUserType,
    status: user.status || 'ACTIVE'
  });

  const refreshToken = generateRefreshToken({
    id: idStr,
    userId: idStr,
    email: user.email,
    userType: finalUserType,
    role: finalUserType,
    status: user.status || 'ACTIVE'
  });

  await saveRefreshToken(idStr, finalUserType, refreshToken);

  const userSafe = { ...user };
  delete userSafe.passwordHash;

  logger.info(`User logged in: ${user._id} (${finalUserType})`);
  return { user: userSafe, token, refreshToken };
};

/**
 * Refreshes an access token using a valid refresh token.
 */
export const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) throw new ValidationError('Refresh token is required');

  const decoded = verifyRefreshToken(refreshToken);
  const db = getDb();

  const stored = await db.collection('refresh_tokens').findOne({
    token: refreshToken,
    revoked: false
  });

  if (!stored) {
    throw new AuthenticationError('Refresh token has been revoked or is invalid');
  }

  const newToken = generateToken({
    id: decoded.id || decoded.userId,
    email: decoded.email,
    userType: decoded.userType,
    role: decoded.userType
  });

  return { token: newToken };
};

/**
 * Invalidates a refresh token upon logout.
 */
export const logout = async (refreshToken) => {
  if (!refreshToken) return { success: true, message: 'Logged out' };

  const db = getDb();
  await db.collection('refresh_tokens').updateOne(
    { token: refreshToken },
    { $set: { revoked: true, revokedAt: new Date() } }
  );

  return { success: true, message: 'Logged out successfully' };
};

/**
 * Initiates forgot password flow.
 */
export const forgotPassword = async (email) => {
  if (!validateEmail(email)) throw new ValidationError('Valid email is required');

  const db = getDb();
  let user = await db.collection('athletes').findOne({ email });
  let colName = 'athletes';
  if (!user) {
    user = await db.collection('organizations').findOne({ email });
    colName = 'organizations';
  }
  if (!user) {
    user = await db.collection('admins').findOne({ email });
    colName = 'admins';
  }

  if (!user) {
    // Return friendly message without revealing user enumeration
    return { success: true, message: 'If an account exists with this email, password reset instructions have been generated.' };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.collection(colName).updateOne(
    { _id: user._id },
    { $set: { resetPasswordToken: hashedResetToken, resetPasswordExpires: resetExpires } }
  );

  logger.info(`Password reset token generated for ${email}`);

  // Send email if configured
  try {
    const { sendEmail, isEmailConfigured } = await import('./emailService.js');
    if (isEmailConfigured()) {
      await sendEmail({
        to: email,
        subject: 'AthletIQ - Password Reset Instructions',
        text: `Your password reset token is: ${resetToken}. It is valid for 1 hour.`,
        html: `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Use the following token within 1 hour:</p>
          <p style="font-size: 18px; font-weight: bold; background: #f3f4f6; padding: 10px; border-radius: 6px;">${resetToken}</p>
        </div>`
      });
    }
  } catch (emailErr) {
    logger.warn('Failed to dispatch password reset email', { error: emailErr.message });
  }

  if (process.env.NODE_ENV === 'development') {
    logger.info(`[DEV ONLY] Password reset token for ${email}: ${resetToken}`);
  }

  return {
    success: true,
    message: 'If an account exists with this email, password reset instructions have been generated and dispatched.'
  };
};

/**
 * Resets password using resetToken.
 */
export const resetPassword = async (data) => {
  const resetToken = data.resetToken || data.token;
  const newPassword = data.newPassword || data.password;
  if (!resetToken || !newPassword) throw new ValidationError('Reset token and new password are required');

  const pwdCheck = validatePassword(newPassword);
  if (!pwdCheck.valid) throw new ValidationError(pwdCheck.error);

  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  const now = new Date();
  const db = getDb();

  const query = {
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: now }
  };

  let colName = 'athletes';
  let user = await db.collection('athletes').findOne(query);
  if (!user) {
    user = await db.collection('organizations').findOne(query);
    colName = 'organizations';
  }
  if (!user) {
    user = await db.collection('admins').findOne(query);
    colName = 'admins';
  }

  if (!user) {
    throw new ValidationError('Invalid or expired password reset token');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.collection(colName).updateOne(
    { _id: user._id },
    {
      $set: { passwordHash, updatedAt: new Date() },
      $unset: { resetPasswordToken: '', resetPasswordExpires: '' }
    }
  );

  // Revoke ALL existing refresh tokens for this user (security: invalidate old sessions)
  const userIdStr = user._id.toString();
  await db.collection('refresh_tokens').updateMany(
    { userId: userIdStr, revoked: false },
    { $set: { revoked: true, revokedAt: new Date(), revokeReason: 'password_reset' } }
  );

  logger.info(`Password successfully reset for user ${user._id}. All refresh tokens revoked.`);
  return { success: true, message: 'Password reset successfully. You can now log in with your new password.' };
};
