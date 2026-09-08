export const USER_TYPES = { ATHLETE: 'athlete', ORGANIZATION: 'organization', ADMIN: 'admin' };

// ROLES is an alias for USER_TYPES — multiple files import { ROLES }
export const ROLES = USER_TYPES;

export const ORG_TYPES = { ACADEMY: 'Academy', COLLEGE: 'College', COMPANY: 'Company', FEDERATION: 'Federation' };

export const SPORTS = [
  'Cricket', 'Football', 'Athletics', 'Swimming', 'Badminton', 'Tennis', 'Hockey',
  'Boxing', 'Wrestling', 'Shooting', 'Archery', 'Kabaddi', 'Basketball', 'Volleyball',
  'Table Tennis', 'Cycling', 'Weightlifting', 'Gymnastics', 'Martial Arts', 'Other'
];

export const ACHIEVEMENT_LEVELS = {
  DISTRICT: 'District',
  STATE: 'State',
  NATIONAL: 'National',
  INTERNATIONAL: 'International'
};

// Section 5 Master Spec: All 10 Opportunity Categories
export const OPP_TYPES = {
  TRIALS: 'Trials',
  COMPETITIONS: 'Competitions',
  SCHOLARSHIPS: 'Scholarships',
  CAMPS: 'Camps',
  SELECTION_PROGRAMS: 'Selection programs',
  CHAMPIONSHIPS: 'Championships',
  GOVERNMENT_SCHEMES: 'Government schemes',
  ACADEMY_SELECTIONS: 'Academy selections',
  INTERNSHIPS: 'Internships',
  SPORTS_PROGRAMS: 'Sports programs',
  // Backwards compatibility aliases
  TRIAL: 'Trials',
  TOURNAMENT: 'Competitions',
  CAMP: 'Camps',
  SCHOLARSHIP: 'Scholarships'
};

// Section 7 Master Spec: All 11 Sports Job Categories
export const SPORTS_JOB_TYPES = {
  COACHING_ASSISTANT: 'Sports coaching assistant',
  FITNESS_TRAINER_ASSISTANT: 'Fitness trainer assistant',
  PHOTOGRAPHER: 'Sports photographer',
  EVENT_VOLUNTEER: 'Event volunteer',
  ANALYST: 'Sports analyst',
  REFEREE_ASSISTANT: 'Referee assistant',
  ACADEMY_ASSISTANT: 'Academy assistant',
  CONTENT_CREATOR: 'Sports content creator',
  PHYSIO_ASSISTANT: 'Physiotherapy assistant',
  GROUND_STAFF: 'Ground staff',
  EVENT_MANAGEMENT: 'Event management'
};

export const JOB_EMPLOYMENT_TYPES = {
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  FREELANCE: 'Freelance'
};

export const JOB_TYPES = {
  ...JOB_EMPLOYMENT_TYPES,
  ...SPORTS_JOB_TYPES
};

export const APPLICATION_STATUS = {
  APPLIED: 'Applied',
  PENDING: 'Pending',
  SHORTLISTED: 'Shortlisted',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn'
};

export const APPLICATION_TYPES = {
  OPPORTUNITY: 'opportunity',
  JOB: 'job',
  SPONSORSHIP: 'sponsorship'
};

export const LISTING_STATUS = {
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled'
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY: 429,
  SERVER_ERROR: 500
};

// Section 6 Master Spec: Exact 100% weights.
// This is the single source of truth for match scoring weights — do not
// redefine these numbers elsewhere (services/matchingService.js imports and
// re-exports this object instead of declaring its own copy).
export const MATCH_WEIGHTS = {
  SPORT: 25,
  AGE: 20,
  PERFORMANCE: 30,
  LOCATION: 10,
  EXPERIENCE: 10,
  OTHER: 5
};

// Minimum weighted score for a listing to appear in an athlete's match
// results at all (a low-relevance cutoff, not an eligibility check).
export const MATCH_MIN_SCORE = 25;

// Minimum weighted score, combined with passing all hard filters, for a
// listing to be flagged isEligible: true. Anything that reads or reports
// eligibility (matching service, dashboard counts, cron deadline alerts)
// must use this single constant rather than its own hardcoded number, so
// "eligible" always means the same thing everywhere in the app.
export const MATCH_ELIGIBLE_SCORE = 40;

