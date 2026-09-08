import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../models/Notification.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export const getMyNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const { notifications, unreadCount } = await getUserNotifications(req.user.id, {
      page,
      limit,
      unreadOnly
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        page,
        limit
      }
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const updated = await markNotificationRead(req.params.id, req.user.id);
    if (!updated) {
      throw new NotFoundError('Notification not found or already read');
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const count = await markAllNotificationsRead(req.user.id);
    res.status(200).json({
      success: true,
      message: `Marked ${count} notifications as read`
    });
  } catch (error) {
    next(error);
  }
};
