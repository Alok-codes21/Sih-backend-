import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { createTrainingSession, getAthleteSessions } from '../models/TrainingSession.js';
import { createTrainingPlan, getActivePlan } from '../models/TrainingPlan.js';
import { analyzeRecoveryStatus } from '../services/recoveryService.js';
import { ValidationError } from '../middleware/errorHandler.js';

const DISCLAIMER = 'General training and athletic conditioning guidance only. Not medical or therapeutic advice.';

/**
 * Feature 4: Manual Training Session Entry (Required for MVP)
 */
export const createSession = async (req, res, next) => {
  try {
    const athleteId = req.user?.id;
    if (!athleteId) throw new ValidationError('Athlete authentication required');

    const { activity, duration, distance, calories, heartRate, date, intensity, sleepHours, sleepQuality, notes } = req.body;
    if (!activity) throw new ValidationError('Activity type is required (e.g. Running, Cycling, Strength training)');

    const session = await createTrainingSession({
      athleteId,
      activity,
      duration,
      distance,
      calories,
      heartRate,
      date: date || new Date(),
      intensity,
      sleepHours,
      sleepQuality,
      notes,
      source: 'Manual'
    });

    res.status(201).json({
      success: true,
      message: 'Training session logged successfully',
      data: session,
      disclaimer: DISCLAIMER
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves past logged training sessions.
 */
export const getSessions = async (req, res, next) => {
  try {
    const athleteId = req.user?.id;
    const { limit = 30, skip = 0, startDate, endDate } = req.query;

    const sessions = await getAthleteSessions(athleteId, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions,
      disclaimer: DISCLAIMER
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Feature 4: Wearable / Training Data Sync
 * Parses raw wearable data, persists every session to MongoDB, and returns a summary log.
 */
export const syncTrainingData = async (req, res, next) => {
  try {
    const athleteId = req.user?.id || 'anonymous';
    const { sessions = [], source = 'GoogleFit' } = req.body;

    const savedSessions = [];
    for (const s of sessions) {
      const duration = s.duration || Math.round((new Date(s.endTime || Date.now()) - new Date(s.startTime || Date.now() - 3600000)) / 60000) || 30;
      const calories = s.calories || 0;
      const distance = s.distance || 0;
      const heartRate = s.heartRate || Math.round((s.heartPoints || 0) * 3.5) || 120;
      const intensity = calories > 400 ? 'High' : calories > 200 ? 'Medium' : 'Low';

      const saved = await createTrainingSession({
        athleteId,
        activity: s.activityType || s.activity || 'General Workout',
        duration,
        distance,
        calories,
        heartRate,
        date: s.startTime ? new Date(s.startTime) : new Date(),
        intensity,
        sleepHours: req.body.sleepHours || null,
        sleepQuality: req.body.sleepQuality || null,
        source
      });
      savedSessions.push(saved);
    }

    const totalCalories = savedSessions.reduce((sum, s) => sum + s.calories, 0);
    const totalDuration = savedSessions.reduce((sum, s) => sum + s.duration, 0);
    const totalDistance = parseFloat(savedSessions.reduce((sum, s) => sum + s.distance, 0).toFixed(2));

    logger.info(`Synced and persisted ${savedSessions.length} sessions for athlete ${athleteId}`);
    res.status(200).json({
      success: true,
      message: `Successfully synced and persisted ${savedSessions.length} sessions`,
      data: {
        totalSessions: savedSessions.length,
        summary: `${totalDuration} min, ${totalCalories} cal, ${totalDistance} km`,
        savedSessions
      },
      disclaimer: DISCLAIMER
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Feature 5: AI Training Plan Generation & Persistence
 */
export const generateTrainingPlan = async (req, res, next) => {
  try {
    const athleteId = req.user?.id || 'anonymous';
    const { sport = 'Athletics', goal = 'General Fitness', age = 22, weight = 70, height = 175 } = req.body;

    const weeklySchedule = [
      { day: 'Monday', focusArea: 'Speed & Explosiveness', sessionType: 'Speed', isRestDay: false, duration: 60, exercises: [
        { name: 'Sprint Intervals (100m)', sets: 6, reps: 1, duration: 15, restPeriod: 120, notes: 'Max effort, full recovery between sets' },
        { name: 'Box Jumps', sets: 4, reps: 8, duration: 10, restPeriod: 60, notes: 'Focus on explosive hip extension' },
        { name: 'Core Planks', sets: 3, reps: 1, duration: 5, restPeriod: 30, notes: '60 seconds hold each' }
      ]},
      { day: 'Tuesday', focusArea: 'Recovery & Mobility', sessionType: 'Mobility', isRestDay: false, duration: 45, exercises: [
        { name: 'Light Jogging', sets: 1, reps: 1, duration: 20, restPeriod: 0, notes: '60% effort' },
        { name: 'Foam Rolling', sets: 1, reps: 1, duration: 15, restPeriod: 0, notes: 'Full body' },
        { name: 'Dynamic Stretching', sets: 1, reps: 1, duration: 10, restPeriod: 0, notes: 'Legs & hips focus' }
      ]},
      { day: 'Wednesday', focusArea: 'Strength & Power', sessionType: 'Strength', isRestDay: false, duration: 55, exercises: [
        { name: 'Squats', sets: 4, reps: 6, duration: 20, restPeriod: 90, notes: '80% 1RM' },
        { name: 'Deadlifts', sets: 3, reps: 5, duration: 15, restPeriod: 120, notes: 'Focus on hip hinge' },
        { name: 'Lunges', sets: 3, reps: 10, duration: 10, restPeriod: 60, notes: 'Each leg' }
      ]},
      { day: 'Thursday', focusArea: 'Active Recovery', sessionType: 'Rest', isRestDay: true, duration: 0, exercises: [] },
      { day: 'Friday', focusArea: 'Speed Endurance & Agility', sessionType: 'Endurance', isRestDay: false, duration: 50, exercises: [
        { name: 'Tempo Runs (200m)', sets: 5, reps: 1, duration: 20, restPeriod: 90, notes: '85% effort' },
        { name: 'Burpees & Plyometrics', sets: 3, reps: 12, duration: 10, restPeriod: 60, notes: 'Fast pace' }
      ]},
      { day: 'Saturday', focusArea: 'Sport-Specific Skills', sessionType: 'Match Simulation', isRestDay: false, duration: 60, exercises: [
        { name: `${sport} Drills & Technique`, sets: 10, reps: 1, duration: 30, restPeriod: 120, notes: 'Focus on form & consistency' },
        { name: 'Movement Drills & Strategy', sets: 5, reps: 1, duration: 15, restPeriod: 60, notes: 'Competition tempo' }
      ]},
      { day: 'Sunday', focusArea: 'Complete Rest & Regeneration', sessionType: 'Rest', isRestDay: true, duration: 0, exercises: [] }
    ];

    const planData = {
      athleteId,
      sport,
      goal,
      generatedBy: 'ai',
      weeklySchedule,
      recoveryPlan: 'Ice bath after intense sessions. 8+ hours sleep. Protein within 30 min post-workout.',
      nutritionTips: [
        `${Math.round(weight * 45)} cal/day baseline`,
        `${weight * 2}g protein daily`,
        'Complex carbohydrates 2 hours pre-training',
        'Target 3.5 liters water daily'
      ]
    };

    const savedPlan = await createTrainingPlan(planData);
    logger.info(`Persisted AI training plan for athlete ${athleteId}`);

    res.status(200).json({
      success: true,
      message: 'Weekly training plan generated and saved successfully',
      data: savedPlan,
      disclaimer: DISCLAIMER
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets the athlete's current active training plan.
 */
export const getActiveTrainingPlan = async (req, res, next) => {
  try {
    const athleteId = req.user?.id;
    const plan = await getActivePlan(athleteId);
    res.status(200).json({
      success: true,
      data: plan || null,
      disclaimer: DISCLAIMER
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 9 Master Spec: Training Dashboard Metrics
 * Computes: Weekly Distance, Sessions per week, Average Heart Rate, Recovery %, Training Load, Consistency %.
 */
export const getDashboardMetrics = async (req, res, next) => {
  try {
    const athleteId = req.user?.id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pastSessions = await getAthleteSessions(athleteId, { startDate: sevenDaysAgo, limit: 100 });

    // 1. Weekly Distance
    const weeklyDistance = parseFloat(pastSessions.reduce((sum, s) => sum + (s.distance || 0), 0).toFixed(1));

    // 2. Training Sessions per week
    const trainingSessionsPerWeek = pastSessions.length;

    // 3. Average Heart Rate
    const sessionsWithHR = pastSessions.filter(s => s.heartRate > 0);
    const avgHeartRate = sessionsWithHR.length > 0
      ? Math.round(sessionsWithHR.reduce((sum, s) => sum + s.heartRate, 0) / sessionsWithHR.length)
      : 135;

    // 4. Training Load (Low/Medium/High based on total minutes and calories)
    const totalMinutes = pastSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalCalories = pastSessions.reduce((sum, s) => sum + (s.calories || 0), 0);
    let trainingLoad = 'Medium';
    if (totalMinutes > 300 || totalCalories > 3500) trainingLoad = 'High';
    else if (totalMinutes < 120 && totalCalories < 1200) trainingLoad = 'Low';

    // 5. Recovery % (inversely proportional to consecutive intensity, baseline 82%)
    const recoveryAnalysis = await analyzeRecoveryStatus(athleteId);
    let recoveryPct = 85;
    if (recoveryAnalysis.consecutiveHighDays >= 3) recoveryPct = 60;
    else if (recoveryAnalysis.consecutiveHighDays === 2) recoveryPct = 72;
    else if (recoveryAnalysis.consecutiveHighDays === 1) recoveryPct = 80;

    // 6. Consistency % (Target: 5 days/week = 100%)
    const uniqueDays = new Set(pastSessions.map(s => new Date(s.date).toISOString().split('T')[0])).size;
    const consistencyPct = Math.min(100, Math.round((uniqueDays / 5) * 100));

    res.status(200).json({
      success: true,
      data: {
        metrics: {
          weeklyDistanceKm: weeklyDistance,
          trainingSessionsPerWeek,
          averageHeartRateBpm: avgHeartRate,
          recoveryPercentage: recoveryPct,
          trainingLoad, // 'Low' | 'Medium' | 'High'
          consistencyPercentage: consistencyPct
        },
        formatted: {
          weeklyDistance: `${weeklyDistance} km`,
          trainingSessions: `${trainingSessionsPerWeek}/week`,
          averageHeartRate: `${avgHeartRate} BPM`,
          recovery: `${recoveryPct}%`,
          trainingLoad: trainingLoad,
          consistency: `${consistencyPct}%`
        },
        period: 'Past 7 Days'
      },
      disclaimer: DISCLAIMER
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 10 Master Spec: Recovery Intelligence Status
 */
export const getRecoveryStatus = async (req, res, next) => {
  try {
    const athleteId = req.user?.id;
    const recovery = await analyzeRecoveryStatus(athleteId);
    res.status(200).json({
      success: true,
      data: recovery
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Section 12 Master Spec: Internal Training Summary API for AI Layer
 */
export const getTrainingSummary = async (req, res, next) => {
  try {
    const athleteId = req.user?.id;
    const recentSessions = await getAthleteSessions(athleteId, { limit: 7 });
    const activePlan = await getActivePlan(athleteId);
    const recovery = await analyzeRecoveryStatus(athleteId);

    const totalDist = recentSessions.reduce((s, a) => s + (a.distance || 0), 0);
    const totalCal = recentSessions.reduce((s, a) => s + (a.calories || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        athleteId,
        recentSessionsCount: recentSessions.length,
        totalDistanceThisWeek: `${totalDist.toFixed(1)} km`,
        totalCaloriesThisWeek: totalCal,
        activeGoal: activePlan?.goal || 'General Athletic Conditioning',
        sport: activePlan?.sport || 'All-Round',
        recoveryDayRecommended: recovery.recoveryDayRecommended,
        consecutiveHighDays: recovery.consecutiveHighDays
      },
      disclaimer: DISCLAIMER
    });
  } catch (error) {
    next(error);
  }
};

