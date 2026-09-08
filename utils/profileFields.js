/**
 * Whitelists for self-service profile update endpoints.
 *
 * Profile updates previously worked by blacklisting a handful of dangerous
 * keys off of `{ ...req.body }`. That approach silently trusts every other
 * field the client sends, so any sensitive field added to the schema later
 * (or any field an attacker guesses the name of) is exposed unless someone
 * remembers to blacklist it too. These pick functions do the reverse: only
 * fields explicitly listed here are ever copied out of the request body.
 */

/**
 * Fields an athlete is allowed to edit about themselves via
 * PUT /athletes/profile or PATCH /athletes/:id.
 * Deliberately excludes: athleteId, email, passwordHash, isVerified,
 * achievements, verifiedBadge, verificationStatus, userType, role,
 * createdAt, _id — all of those are either identity, admin-only, or
 * managed through their own dedicated endpoints.
 */
const ATHLETE_EDITABLE_FIELDS = [
  'firstName', 'lastName', 'dateOfBirth', 'gender',
  'sport', 'primarySport', 'secondarySport', 'position', 'playingCategory',
  'experience', 'currentAcademy', 'currentInstitution',
  'contactInformation', 'phone', 'profilePicture', 'avatarUrl',
  'city', 'state', 'country', 'location',
  'height', 'weight', 'privacy'
];

/**
 * Fields an organization is allowed to edit about themselves via
 * PATCH /organizations/:id.
 * Deliberately excludes: orgId, email, passwordHash, isVerified,
 * verifiedAt, verificationNotes, userType, role, createdAt, _id.
 */
const ORG_EDITABLE_FIELDS = [
  'name', 'type', 'description', 'sports',
  'city', 'state', 'country', 'location',
  'website', 'phone'
];

/**
 * Picks only whitelisted keys that are actually present in `body`.
 */
const pick = (body, allowedFields) => {
  const result = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }
  return result;
};

/**
 * Builds a safe $set payload for an athlete self-update, recomputing
 * derived fields (name, age, ageGroup, physicalStats.bmi) the same way
 * registration does, so the profile stays internally consistent.
 *
 * @param {Object} body - Raw req.body.
 * @param {Object} current - The athlete's existing document (for fallback values).
 * @returns {Object} Safe fields to pass to $set.
 */
export const buildAthleteProfileUpdate = (body, current = {}) => {
  const picked = pick(body, ATHLETE_EDITABLE_FIELDS);
  const update = {};

  if (picked.firstName !== undefined) update.firstName = picked.firstName;
  if (picked.lastName !== undefined) update.lastName = picked.lastName;
  if (picked.firstName || picked.lastName) {
    const first = picked.firstName ?? current.firstName ?? '';
    const last = picked.lastName ?? current.lastName ?? '';
    update.name = `${first} ${last}`.trim();
  }

  if (picked.dateOfBirth !== undefined) {
    const dob = new Date(picked.dateOfBirth);
    update.dateOfBirth = dob;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    update.age = age;

    let ageGroup = 'Adult';
    if (age < 13) ageGroup = 'Child';
    else if (age < 18) ageGroup = 'Teen';
    else if (age > 40) ageGroup = 'Veteran';
    update.ageGroup = ageGroup;
  }

  for (const field of ['gender', 'position', 'playingCategory', 'experience', 'currentAcademy', 'currentInstitution', 'city', 'state', 'country', 'location', 'secondarySport', 'privacy']) {
    if (picked[field] !== undefined) update[field] = picked[field];
  }

  if (picked.sport !== undefined) {
    update.sport = Array.isArray(picked.sport) ? picked.sport : (picked.sport ? [picked.sport] : []);
  }
  if (picked.primarySport !== undefined) update.primarySport = picked.primarySport;

  if (picked.contactInformation !== undefined || picked.phone !== undefined) {
    update.contactInformation = picked.contactInformation ?? picked.phone;
  }
  if (picked.profilePicture !== undefined || picked.avatarUrl !== undefined) {
    update.profilePicture = picked.profilePicture ?? picked.avatarUrl;
  }

  if (picked.height !== undefined || picked.weight !== undefined) {
    const height = picked.height ?? current.physicalStats?.height ?? null;
    const weight = picked.weight ?? current.physicalStats?.weight ?? null;
    update.physicalStats = {
      height,
      weight,
      bmi: height && weight ? parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1)) : null
    };
  }

  return update;
};

/**
 * Builds a safe $set payload for an organization self-update.
 *
 * @param {Object} body - Raw req.body.
 * @returns {Object} Safe fields to pass to $set.
 */
export const buildOrgProfileUpdate = (body) => {
  const picked = pick(body, ORG_EDITABLE_FIELDS);
  const update = { ...picked };

  if (picked.sports !== undefined) {
    update.sports = Array.isArray(picked.sports) ? picked.sports : (picked.sports ? [picked.sports] : []);
  }

  return update;
};
