/**
 * Input validation and utility functions.
 */

/**
 * Validates an email address format.
 * @param {string} email
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Validates a password meets strength requirements.
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
export const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters long.' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must contain at least one uppercase letter.' };
  if (!/\d/.test(password)) return { valid: false, error: 'Password must contain at least one number.' };
  return { valid: true };
};

/**
 * Validates that required fields are present in a body object.
 *
 * Supports two calling conventions:
 *   validateRequired(['email', 'password'], reqBody)   — array of field names + object
 *   validateRequired({ email, password })              — single object (all keys required)
 *
 * @param {string[]|Object} fieldsOrBody
 * @param {Object} [body]
 * @returns {{ valid: boolean, missing: string[], error?: string }}
 */
export const validateRequired = (fieldsOrBody, body) => {
  let fields;
  let target;

  if (Array.isArray(fieldsOrBody)) {
    // Called as validateRequired(['email', 'password'], reqBody)
    fields = fieldsOrBody;
    target = body || {};
  } else if (typeof fieldsOrBody === 'object' && fieldsOrBody !== null) {
    // Called as validateRequired({ email, password, ... })
    fields = Object.keys(fieldsOrBody);
    target = fieldsOrBody;
  } else {
    return { valid: false, missing: [], error: 'Invalid arguments to validateRequired' };
  }

  const missing = fields.filter(field => {
    const val = target[field];
    return val === undefined || val === null || val === '';
  });

  if (missing.length > 0) {
    return { valid: false, missing, error: `Missing required fields: ${missing.join(', ')}` };
  }
  return { valid: true, missing: [] };
};

/**
 * Strips HTML/script tags from a string to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/<[^>]*>?/gm, '').trim();
};

/**
 * Calculates age from a date of birth string.
 * @param {string|Date} dateOfBirth
 * @returns {number}
 */
export const calculateAge = (dateOfBirth) => {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
};

/**
 * Calculates BMI from height (cm) and weight (kg).
 * @param {number} heightCm - Height in centimeters.
 * @param {number} weightKg - Weight in kilograms.
 * @returns {number|null} BMI rounded to 1 decimal, or null if inputs are invalid.
 */
export const calculateBMI = (heightCm, weightKg) => {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const heightM = heightCm / 100;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
};
