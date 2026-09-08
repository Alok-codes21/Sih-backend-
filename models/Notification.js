import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const getNotificationsCollection = () => {
  return getDb().collection('notifications');
};

/**
 * Creates a new in-app notification.
 *
 * @param {Object} notificationData
 * @param {string} notificationData.userId - Recipient athlete or org ID (UUID or ObjectId string)
 * @param {string} notificationData.title - Short title of notification
 * @param {string} notificationData.message - Notification body text
 * @param {string} notificationData.type - 'OPPORTUNITY_MATCH' | 'DEADLINE_ALERT' | 'ACHIEVEMENT_VERIFIED' | 'APPLICATION_UPDATE' | 'GENERAL'
 * @param {Object} [notificationData.data] - Associated metadata (e.g. { oppId, matchScore })
 * @returns {Promise<Object>}
 */
export const createNotification = async ({ userId, title, message, type = 'GENERAL', data = {} }) => {
  try {
    const notification = {
      notificationId: crypto.randomUUID(),
      userId: userId.toString(),
      title,
      message,
      type,
      data,
      isRead: false,
      createdAt: new Date()
    };

    const result = await getNotificationsCollection().insertOne(notification);
    logger.info(`Notification created for user ${userId}`, { type, title });
    return { ...notification, _id: result.insertedId };
  } catch (error) {
    logger.error('Error creating notification', { error: error.message });
    throw error;
  }
};

const safeObjectId = (id) => {
  try {
    return new ObjectId(id);
  } catch (e) {
    return null;
  }
};

/**
 * Gets paginated notifications for a user.
 */
export const getUserNotifications = async (userId, { limit = 20, page = 1, unreadOnly = false } = {}) => {
  try {
    const userStr = userId.toString();
    const userConditions = [{ userId: userStr }];
    const userOid = safeObjectId(userStr);
    if (userOid) userConditions.push({ userId: userOid });

    const query = { $or: userConditions };

    if (unreadOnly) {
      query.isRead = false;
    }

    const skip = (page - 1) * limit;

    const notifications = await getNotificationsCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const unreadCount = await getNotificationsCollection().countDocuments({
      ...query,
      isRead: false
    });

    return { notifications, unreadCount };
  } catch (error) {
    logger.error('Error fetching notifications', { error: error.message });
    throw error;
  }
};

/**
 * Marks a specific notification as read.
 */
export const markNotificationRead = async (notificationId, userId) => {
  try {
    const userStr = userId.toString();
    const notifConditions = [{ notificationId }];
    const notifOid = safeObjectId(notificationId);
    if (notifOid) notifConditions.push({ _id: notifOid });

    const userConditions = [{ userId: userStr }];
    const userOid = safeObjectId(userStr);
    if (userOid) userConditions.push({ userId: userOid });

    const query = {
      $and: [
        { $or: notifConditions },
        { $or: userConditions }
      ]
    };

    const result = await getNotificationsCollection().updateOne(
      query,
      { $set: { isRead: true, readAt: new Date() } }
    );

    return result.modifiedCount > 0;
  } catch (error) {
    logger.error('Error marking notification read', { error: error.message });
    throw error;
  }
};

/**
 * Marks all notifications as read for a user.
 */
export const markAllNotificationsRead = async (userId) => {
  try {
    const userStr = userId.toString();
    const userConditions = [{ userId: userStr }];
    const userOid = safeObjectId(userStr);
    if (userOid) userConditions.push({ userId: userOid });

    const result = await getNotificationsCollection().updateMany(
      {
        $or: userConditions,
        isRead: false
      },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return result.modifiedCount;
  } catch (error) {
    logger.error('Error marking all notifications read', { error: error.message });
    throw error;
  }
};
