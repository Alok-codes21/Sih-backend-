import crypto from 'crypto';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const getTrainingPlansCollection = () => {
  return getDb().collection('training_plans');
};

/**
 * Creates and persists a weekly training plan.
 */
export const createTrainingPlan = async (planData) => {
  try {
    const planId = crypto.randomUUID();
    const newPlan = {
      planId,
      athleteId: planData.athleteId.toString(),
      sport: planData.sport || 'Athletics',
      goal: planData.goal || 'General Fitness',
      generatedBy: planData.generatedBy || 'ai',
      status: 'Active',
      weeklySchedule: planData.weeklySchedule || [],
      recoveryPlan: planData.recoveryPlan || '',
      nutritionTips: planData.nutritionTips || [],
      startDate: planData.startDate ? new Date(planData.startDate) : new Date(),
      endDate: planData.endDate ? new Date(planData.endDate) : new Date(Date.now() + 7 * 86400000),
      disclaimer: 'General training and wellness guidance only. Not medical or therapeutic advice.',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await getTrainingPlansCollection().insertOne(newPlan);
    logger.info(`Training plan created: ${planId} for athlete ${planData.athleteId}`);
    return { ...newPlan, _id: result.insertedId };
  } catch (error) {
    logger.error('Error creating training plan', { error: error.message });
    throw error;
  }
};

/**
 * Gets the active training plan for an athlete.
 */
export const getActivePlan = async (athleteId) => {
  try {
    return await getTrainingPlansCollection().findOne(
      { athleteId: athleteId.toString(), status: 'Active' },
      { sort: { createdAt: -1 } }
    );
  } catch (error) {
    logger.error('Error fetching active training plan', { error: error.message });
    throw error;
  }
};
