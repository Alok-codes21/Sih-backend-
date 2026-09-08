import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { calculateAge } from '../utils/validators.js';
import { MATCH_WEIGHTS, MATCH_MIN_SCORE, MATCH_ELIGIBLE_SCORE } from '../utils/constants.js';
import { ObjectId } from 'mongodb';

// Section 6 Master Spec: Must total 100%.
// ELIGIBILITY_WEIGHTS is kept as an exported alias (rather than a second
// definition) so this file and utils/constants.js can never drift out of
// sync the way MATCH_WEIGHTS/ELIGIBILITY_WEIGHTS previously could.
export const ELIGIBILITY_WEIGHTS = MATCH_WEIGHTS;

const safeObjectId = (id) => {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
};

export const escapeRegex = (str) => {
  return str ? str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
};

export const normalizeSport = (s) => (s || '').toString().trim().toLowerCase();

export const sportMatches = (athleteSports, listingSports) => {
  if (!listingSports || listingSports.length === 0) return true;
  if (!athleteSports || athleteSports.length === 0) return false;
  return athleteSports.some(a => {
    const normA = normalizeSport(a);
    if (!normA) return false;
    return listingSports.some(l => {
      const normL = normalizeSport(l);
      if (!normL) return false;
      return normA === normL || normA.includes(normL) || normL.includes(normA);
    });
  });
};

/**
 * Checks boolean hard filters.
 * Returns { pass: boolean, failedFilters: string[] }
 */
export const checkHardFilters = (athlete, listing) => {
  const failed = [];
  const now = new Date();

  // 1. Deadline filter
  if (listing.deadline && new Date(listing.deadline) < now) {
    failed.push('Deadline passed');
  }

  // 2. Sport filter (athlete must participate in the required sport)
  const athleteSports = Array.isArray(athlete.sport)
    ? athlete.sport
    : (Array.isArray(athlete.sports) ? athlete.sports : [athlete.sport, athlete.primarySport].filter(Boolean));
  
  const listingSports = Array.isArray(listing.sport)
    ? listing.sport
    : (listing.sport ? [listing.sport] : []);

  if (listingSports.length > 0) {
    const hasSport = sportMatches(athleteSports, listingSports);
    if (!hasSport) {
      failed.push('Sport mismatch');
    }
  }

  // 3. Age filter
  const age = athlete.age !== undefined && athlete.age !== null
    ? athlete.age
    : (athlete.dateOfBirth ? calculateAge(athlete.dateOfBirth) : null);
  const minAge = listing.eligibility?.minAge ?? listing.minAge;
  const maxAge = listing.eligibility?.maxAge ?? listing.maxAge;

  if (minAge || maxAge) {
    if (age === null) {
      failed.push('Age not specified in profile');
    } else {
      if (minAge && age < minAge) failed.push(`Age below minimum (${minAge})`);
      if (maxAge && age > maxAge) failed.push(`Age above maximum (${maxAge})`);
    }
  }

  // 4. Gender filter
  const requiredGender = listing.eligibility?.gender || listing.gender;
  if (requiredGender && requiredGender !== 'Any' && requiredGender !== 'Both') {
    if (athlete.gender && athlete.gender.toLowerCase() !== requiredGender.toLowerCase()) {
      failed.push('Gender requirement not met');
    }
  }

  // 5. Level requirement hard filter (verified achievement required)
  const requiredLevel = listing.eligibility?.requiredLevel || listing.requiredLevel || listing.level;
  if (requiredLevel && requiredLevel !== 'Any' && requiredLevel !== 'Open') {
    const levelHierarchy = { 'District': 1, 'State': 2, 'National': 3, 'International': 4 };
    const neededLevel = levelHierarchy[requiredLevel] || 1;
    const verifiedAchievements = (athlete.achievements || []).filter(a => a.verificationStatus === 'VERIFIED');
    const athleteHighestLevel = verifiedAchievements.reduce((max, ach) => {
      const lvl = levelHierarchy[ach.level] || 1;
      return lvl > max ? lvl : max;
    }, 0);

    if (athleteHighestLevel < neededLevel) {
      failed.push(`Verified ${requiredLevel} level achievement required`);
    }
  }

  return {
    pass: failed.length === 0,
    failedFilters: failed
  };
};

/**
 * Calculates a weighted match score between an athlete and a listing (0 - 100%).
 *
 * @param {Object} athlete
 * @param {Object} listing
 * @param {Array} [athleteStats=[]] - Sport-specific performance stats records
 * @returns {{ score: number, isEligible: boolean, breakdown: Object }}
 */
export const calculateEligibilityScore = (athlete, listing, athleteStats = []) => {
  let score = 0;
  const breakdown = {};

  const hardCheck = checkHardFilters(athlete, listing);

  // 1. Sport Match (25%)
  const athleteSports = Array.isArray(athlete.sport)
    ? athlete.sport
    : (Array.isArray(athlete.sports) ? athlete.sports : [athlete.sport, athlete.primarySport].filter(Boolean));
  const listingSports = Array.isArray(listing.sport) ? listing.sport : (listing.sport ? [listing.sport] : []);

  if (listingSports.length === 0 || sportMatches(athleteSports, listingSports)) {
    score += ELIGIBILITY_WEIGHTS.SPORT;
    breakdown.sport = ELIGIBILITY_WEIGHTS.SPORT;
  } else {
    breakdown.sport = 0;
  }

  // 2. Age Match (20%)
  const age = athlete.age !== undefined && athlete.age !== null
    ? athlete.age
    : (athlete.dateOfBirth ? calculateAge(athlete.dateOfBirth) : null);
  const minAge = listing.eligibility?.minAge ?? listing.minAge;
  const maxAge = listing.eligibility?.maxAge ?? listing.maxAge;

  if (!minAge && !maxAge) {
    score += ELIGIBILITY_WEIGHTS.AGE;
    breakdown.age = ELIGIBILITY_WEIGHTS.AGE;
  } else if (age !== null && (!minAge || age >= minAge) && (!maxAge || age <= maxAge)) {
    score += ELIGIBILITY_WEIGHTS.AGE;
    breakdown.age = ELIGIBILITY_WEIGHTS.AGE;
  } else {
    breakdown.age = 0;
  }

  // 3. Performance Match (30%)
  // Check verified achievements and athlete stats against listing requirements
  let perfScore = 0;
  const verifiedAchievements = (athlete.achievements || []).filter(a => a.verificationStatus === 'VERIFIED');
  const verifiedCount = verifiedAchievements.length;
  const requiredLevel = listing.eligibility?.requiredLevel || listing.requiredLevel || listing.level;

  if (requiredLevel && requiredLevel !== 'Any' && requiredLevel !== 'Open') {
    const levelHierarchy = { 'District': 1, 'State': 2, 'National': 3, 'International': 4 };
    const athleteHighestLevel = verifiedAchievements.reduce((max, ach) => {
      const lvl = levelHierarchy[ach.level] || 1;
      return lvl > max ? lvl : max;
    }, 0);

    const neededLevel = levelHierarchy[requiredLevel] || 1;
    if (athleteHighestLevel >= neededLevel) {
      perfScore += 20;
    } else if (athleteHighestLevel > 0) {
      perfScore += 5;
    }
  } else {
    perfScore += verifiedCount > 0 ? 15 : 10;
  }

  // Evaluate dynamic performance stats against listing benchmarks if present
  const minPerformance = listing.eligibility?.minPerformance || listing.minPerformance;
  if (minPerformance && athleteStats && athleteStats.length > 0) {
    const statMatch = athleteStats.find(s =>
      s.statName && minPerformance.statName &&
      s.statName.toLowerCase().includes(minPerformance.statName.toLowerCase())
    );
    if (statMatch) {
      const val = Number(statMatch.statValue);
      const target = Number(minPerformance.value);
      const op = minPerformance.operator || '<=';
      const meetsBenchmark =
        op === '<=' ? val <= target :
        op === '>=' ? val >= target :
        op === '<'  ? val < target :
        op === '>'  ? val > target : true;
      if (meetsBenchmark) {
        perfScore += 10;
      }
    } else if (verifiedCount > 0) {
      perfScore += 5;
    }
  } else if (verifiedCount > 0 || athleteStats.length > 0) {
    perfScore += 10;
  }

  perfScore = Math.min(perfScore, ELIGIBILITY_WEIGHTS.PERFORMANCE);
  score += perfScore;
  breakdown.performance = perfScore;

  // 4. Location Match (10%)
  const allowedStates = listing.eligibility?.states || listing.states || (listing.location ? [listing.location] : []);
  const athleteLocStr = [
    typeof athlete.state === 'string' ? athlete.state : '',
    typeof athlete.city === 'string' ? athlete.city : '',
    typeof athlete.location === 'string' ? athlete.location : (athlete.location?.state || athlete.location?.city || '')
  ].filter(Boolean).join(' ').toLowerCase();

  if (allowedStates.length === 0 || allowedStates.includes('All') || allowedStates.some(st => typeof st === 'string' && athleteLocStr.includes(st.toLowerCase()))) {
    score += ELIGIBILITY_WEIGHTS.LOCATION;
    breakdown.location = ELIGIBILITY_WEIGHTS.LOCATION;
  } else {
    breakdown.location = 0;
  }

  // 5. Experience Match (10%)
  const minExp = listing.eligibility?.minExperience ?? listing.minExperience ?? 0;
  const parsedExp = parseInt(athlete.experience, 10);
  const athleteExp = Number.isNaN(parsedExp) ? 1 : parsedExp;
  if (athleteExp >= minExp) {
    score += ELIGIBILITY_WEIGHTS.EXPERIENCE;
    breakdown.experience = ELIGIBILITY_WEIGHTS.EXPERIENCE;
  } else {
    breakdown.experience = 5;
  }

  // 6. Other Criteria (5%)
  if (athlete.isVerified || athlete.contactInformation || athlete.currentAcademy) {
    score += ELIGIBILITY_WEIGHTS.OTHER;
    breakdown.other = ELIGIBILITY_WEIGHTS.OTHER;
  } else {
    breakdown.other = 2;
  }

  // Eligibility flag is true only if all hard filters pass AND the weighted
  // score clears MATCH_ELIGIBLE_SCORE. Both conditions matter — a listing
  // can score highly on the weighted components while still failing a hard
  // filter (wrong gender, missing a required verified achievement level),
  // and hardCheck.pass alone says nothing about score. Nothing downstream
  // should re-derive "eligible" from score alone; use this flag.
  const isEligible = hardCheck.pass && score >= MATCH_ELIGIBLE_SCORE;

  return {
    score: Math.min(score, 100),
    isEligible,
    passedHardFilters: hardCheck.pass,
    failedFilters: hardCheck.failedFilters,
    breakdown
  };
};

/**
 * Finds listings for an athlete with 100% spec-aligned scoring & eligibility flag.
 */
const _matchListings = async (athleteId, collectionName) => {
  const db = getDb();
  
  const athleteOid = athleteId.toString().length === 24 ? safeObjectId(athleteId) : null;
  const athlete = await db.collection('athletes').findOne({
    $or: [
      { athleteId: athleteId.toString() },
      ...(athleteOid ? [{ _id: athleteOid }] : [])
    ]
  });
  if (!athlete) throw new NotFoundError('Athlete not found');

  // Fetch sport performance stats if available
  const athleteStats = await db.collection('athlete_stats').find({
    $or: [
      { athleteId: athlete._id.toString() },
      { athleteId: athlete.athleteId }
    ]
  }).toArray();

  const now = new Date();
  
  const listings = await db.collection(collectionName).find({
    $and: [
      { $or: [{ status: 'Active' }, { status: 'active' }, { status: { $exists: false } }] },
      { $or: [{ deadline: { $exists: false } }, { deadline: null }, { deadline: { $gt: now } }] }
    ]
  }).limit(200).toArray();

  const athleteIdStr = athlete._id.toString();
  const athleteUUID = athlete.athleteId ? athlete.athleteId.toString() : athleteIdStr;
  
  const appConditions = [
    { athleteId: athleteIdStr },
    { athleteId: athleteUUID }
  ];
  if (athlete._id) appConditions.push({ athleteId: athlete._id });

  const appliedTargetIds = await db.collection('applications').distinct('targetId', { $or: appConditions });
  const appliedListingIds = await db.collection('applications').distinct('listingId', { $or: appConditions });
  const appliedIdStrings = new Set([
    ...appliedTargetIds.map(id => (id || '').toString()),
    ...appliedListingIds.map(id => (id || '').toString())
  ]);

  const scoredListings = [];

  for (const listing of listings) {
    const listingIdStr = (listing.oppId || listing.jobId || listing.sponsorId || listing._id).toString();
    const listingOidStr = listing._id ? listing._id.toString() : '';
    if (appliedIdStrings.has(listingIdStr) || (listingOidStr && appliedIdStrings.has(listingOidStr))) {
      continue;
    }
    
    const { score, isEligible, breakdown, failedFilters } = calculateEligibilityScore(athlete, listing, athleteStats);
    if (score >= MATCH_MIN_SCORE) {
      scoredListings.push({
        ...listing,
        matchScore: score,
        isEligible,
        eligibilityBadge: isEligible ? '🟢 Eligible' : '🔴 Not Eligible',
        scoreBreakdown: breakdown,
        failedFilters
      });
    }
  }

  scoredListings.sort((a, b) => b.matchScore - a.matchScore);
  
  logger.info(`Matched ${scoredListings.length} ${collectionName} for athlete ${athleteIdStr}`);
  return scoredListings;
};

export const matchOpportunities = async (athleteId) => {
  return _matchListings(athleteId, 'opportunities');
};

export const matchJobs = async (athleteId) => {
  return _matchListings(athleteId, 'jobs');
};

export const matchSponsorships = async (athleteId) => {
  return _matchListings(athleteId, 'sponsorships');
};

/**
 * Reverse Matching: Organization searches athletes by criteria and gets ranked results with match %.
 */
export const searchMatchingAthletes = async ({ sport, minAge, maxAge, state, requiredLevel, minPerformance }) => {
  const db = getDb();
  const andConditions = [];

  if (sport) {
    const escapedSport = escapeRegex(sport);
    andConditions.push({
      $or: [
        { sport: { $regex: escapedSport, $options: 'i' } },
        { primarySport: { $regex: escapedSport, $options: 'i' } },
        { sports: { $regex: escapedSport, $options: 'i' } }
      ]
    });
  }

  if (state) {
    const escapedState = escapeRegex(state);
    andConditions.push({
      $or: [
        { state: { $regex: escapedState, $options: 'i' } },
        { city: { $regex: escapedState, $options: 'i' } }
      ]
    });
  }

  const query = andConditions.length > 0 ? { $and: andConditions } : {};

  const dummyListing = {
    sport: sport ? [sport] : [],
    minAge: minAge ? parseInt(minAge, 10) : null,
    maxAge: maxAge ? parseInt(maxAge, 10) : null,
    states: state ? [state] : [],
    requiredLevel: requiredLevel || null,
    minPerformance: minPerformance || null,
    deadline: new Date(Date.now() + 30 * 86400000)
  };

  const athletes = await db.collection('athletes').find(query).limit(50).toArray();

  const ranked = athletes.map(athlete => {
    const { score, isEligible, breakdown, failedFilters } = calculateEligibilityScore(athlete, dummyListing, []);
    const safeAthlete = { ...athlete };
    delete safeAthlete.passwordHash;
    return {
      athlete: safeAthlete,
      matchScore: score,
      isEligible,
      scoreBreakdown: breakdown,
      failedFilters
    };
  });

  ranked.sort((a, b) => b.matchScore - a.matchScore);
  return ranked;
};

