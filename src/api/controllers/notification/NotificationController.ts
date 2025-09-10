import { Request, Response } from 'express';
import { MoreThanOrEqual } from 'typeorm';

import { UserAuth } from '@/api/entity';
import { Notifications, NotificationType } from '@/api/entity/Notifications';
import { getMessaging, isFirebaseReady } from '@/config/firebase';
import { AppDataSource } from '@/server';
import { sendNotificationToUser } from '@/socket';

// import { generatePresignedUrl } from '../s3/awsControllers';

// FCM Token entity (you may need to create this)
interface FCMToken {
  userId: string;
  fcmToken: string;
  platform: 'android' | 'ios';
  deviceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage for FCM tokens (replace with database in production)
const fcmTokens: Map<string, FCMToken> = new Map();

// Utility function to check for duplicate notifications
const checkForDuplicateNotification = async (
  userId: string,
  message: string,
  type: NotificationType,
  actionId?: string,
  timeWindowMinutes: number = 5
): Promise<Notifications | null> => {
  try {
    const notificationRepo = AppDataSource.getRepository(Notifications);
    const timeWindowAgo = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const queryBuilder = notificationRepo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.message = :message', { message })
      .andWhere('notification.type = :type', { type })
      .andWhere('notification.createdAt >= :timeWindowAgo', { timeWindowAgo });

    if (actionId) {
      queryBuilder.andWhere('notification.actionId = :actionId', { actionId });
    }

    return await queryBuilder.getOne();
  } catch (error) {
    console.error('❌ Error checking for duplicate notification:', error);
    return null;
  }
};

// Enhanced real-time notification emitter
const emitRealTimeNotification = async (userId: string, notification: Notifications) => {
  try {
    const notificationData = {
      ...notification,
      sound: notification.sound,
      vibration: notification.vibration,
      realTime: true,
      deliveryMethod: 'socket',
    };

    console.log(`📡 Emitting real-time notification to user ${userId}:`, {
      id: notification.id,
      type: notification.type,
      message: notification.message?.substring(0, 50) + '...',
    });

    // Use the enhanced sendNotificationToUser function
    const sent = sendNotificationToUser(userId, notificationData);

    if (sent) {
      console.log(`✅ Real-time notification emitted successfully to user ${userId}`);
    } else {
      console.log(`⚠️  User ${userId} not connected, notification will be delivered via push`);
    }

    return sent;
  } catch (error) {
    console.error('❌ Error emitting real-time notification:', error);
    return false;
  }
};

export const createNotification = async (req: Request, res: Response) => {
  const { userId, message, type, user, button, property, status, sound, vibration, actionId } = req.body;

  // Validate required fields
  if (!userId || !message || !type) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, message, or type.',
    });
  }

  try {
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Check if user exists
    const userObj = await userRepo.findOneBy({ id: userId });
    if (!userObj) {
      return res.status(404).json({
        success: false,
        message: 'User ID is invalid or does not exist.',
      });
    }

    // Check for duplicate notification (within last 5 minutes)
    const existingNotification = await checkForDuplicateNotification(userId, message, type, actionId);

    if (existingNotification) {
      console.log(`🔄 Duplicate notification prevented for user ${userId}: ${message}`);
      return res.status(200).json({
        success: true,
        message: 'Notification already exists',
        notification: existingNotification,
      });
    }

    // Create notification
    const notification = AppDataSource.getRepository(Notifications).create({
      userId,
      message,
      type,
      user,
      button,
      property,
      status,
      actionId,
      sound: sound || 'default',
      vibration: vibration || 'default',
    });

    // Save notification
    await AppDataSource.getRepository(Notifications).save(notification);

    // Emit real-time notification
    await emitRealTimeNotification(userId, notification);

    return res.status(201).json({
      success: true,
      notification: notification,
    });
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

// Register FCM token
export const registerFCMToken = async (req: Request, res: Response) => {
  const { userId, fcmToken, platform, deviceId } = req.body;

  if (!userId || !fcmToken || !platform) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, fcmToken, or platform.',
    });
  }

  try {
    // Check if user exists
    const userRepo = AppDataSource.getRepository(UserAuth);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Store FCM token (in production, use database)
    const tokenData: FCMToken = {
      userId,
      fcmToken,
      platform,
      deviceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    fcmTokens.set(fcmToken, tokenData);

    console.log(`📱 FCM token registered for user ${userId}:`, fcmToken);

    return res.status(200).json({
      success: true,
      message: 'FCM token registered successfully',
    });
  } catch (error) {
    console.error('❌ Error registering FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

// Unregister FCM token
export const unregisterFCMToken = async (req: Request, res: Response) => {
  const { userId, fcmToken } = req.body;

  if (!userId || !fcmToken) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId or fcmToken.',
    });
  }

  try {
    // Remove FCM token (in production, use database)
    fcmTokens.delete(fcmToken);

    console.log(`🗑️  FCM token unregistered for user ${userId}:`, fcmToken);

    return res.status(200).json({
      success: true,
      message: 'FCM token unregistered successfully',
    });
  } catch (error) {
    console.error('❌ Error unregistering FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

// Send push notification
export const sendPushNotification = async (userId: string, title: string, body: string, data?: any) => {
  try {
    // Check if Firebase is properly initialized
    if (!isFirebaseReady()) {
      console.log('⚠️  Firebase Admin SDK not initialized, skipping push notification');
      return false;
    }

    // Find user's FCM tokens
    const userTokens: string[] = [];
    for (const [token, tokenData] of fcmTokens.entries()) {
      if (tokenData.userId === userId) {
        userTokens.push(token);
      }
    }

    if (userTokens.length === 0) {
      console.log(`📱 No FCM tokens found for user ${userId}`);
      return false;
    }

    // Send notification to all user's devices
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens: userTokens,
    };

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);

    console.log(`📲 Push notification sent to user ${userId}:`, {
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: userTokens.length,
    });

    // Remove failed tokens
    if (response.failureCount > 0) {
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success) {
          const failedToken = userTokens[idx];
          fcmTokens.delete(failedToken);
          console.log(`🗑️  Removed failed FCM token: ${failedToken}`);
        }
      });
    }

    return response.successCount > 0;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return false;
  }
};

// Update createNotification to also send push notification
export const createNotificationWithPush = async (req: Request, res: Response) => {
  const { userId, message, type, user, button, property, status, sound, vibration, actionId } = req.body;

  // Validate required fields
  if (!userId || !message || !type) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: userId, message, or type.',
    });
  }

  try {
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Check if user exists
    const userObj = await userRepo.findOneBy({ id: userId });
    if (!userObj) {
      return res.status(404).json({
        success: false,
        message: 'User ID is invalid or does not exist.',
      });
    }

    // Check for duplicate notification (within last 5 minutes)
    const existingNotification = await checkForDuplicateNotification(userId, message, type, actionId);

    if (existingNotification) {
      console.log(`🔄 Duplicate notification prevented for user ${userId}: ${message}`);
      return res.status(200).json({
        success: true,
        message: 'Notification already exists',
        notification: existingNotification,
      });
    }

    // Create notification
    const notification = AppDataSource.getRepository(Notifications).create({
      userId,
      message,
      type,
      user,
      button,
      property,
      status,
      actionId,
      sound: sound || 'default',
      vibration: vibration || 'default',
    });

    // Save notification
    await AppDataSource.getRepository(Notifications).save(notification);

    // Send push notification
    const pushData = {
      notificationId: notification.id,
      type: notification.type,
      actionId: notification.actionId || '',
      ...notification.property,
    };

    const pushSent = await sendPushNotification(
      userId,
      type === 'welcome' ? 'Welcome to NextDeal!' : 'New Notification',
      message,
      pushData
    );

    // Emit real-time notification
    const realTimeSent = await emitRealTimeNotification(userId, notification);

    console.log(`📨 Notification delivery summary for user ${userId}:`, {
      pushNotification: pushSent ? '✅ Sent' : '❌ Failed',
      realTimeNotification: realTimeSent ? '✅ Sent' : '⚠️  User not connected',
    });

    return res.status(201).json({
      success: true,
      notification: notification,
      delivery: {
        push: pushSent,
        realTime: realTimeSent,
      },
    });
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  const { notificationId } = req.body;

  if (!notificationId) {
    return res.status(400).json({ success: false, message: 'notificationId is required' });
  }

  try {
    const notificationRepository = AppDataSource.getRepository(Notifications);
    const notification = await notificationRepository.findOneBy({ id: notificationId });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.isRead = true;
    await notificationRepository.save(notification);

    console.log(`✅ Notification ${notificationId} marked as read`);

    return res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Clean up duplicate notifications and bundle them
export const cleanupAndBundleNotifications = async (userId: string) => {
  try {
    const notificationRepo = AppDataSource.getRepository(Notifications);

    // Get all unread notifications for the user
    const notifications = await notificationRepo.find({
      where: { userId, isRead: false },
      order: { createdAt: 'DESC' },
    });

    // Group notifications by type and property
    const notificationGroups = new Map<string, Notifications[]>();

    notifications.forEach((notification) => {
      // Create a key based on type and property title (for property-related notifications)
      let groupKey = notification.type as string;

      if (notification.property?.title) {
        groupKey += `_${notification.property.title}`;
      } else if (notification.user) {
        groupKey += `_${notification.user}`;
      }

      if (!notificationGroups.has(groupKey)) {
        notificationGroups.set(groupKey, []);
      }
      notificationGroups.get(groupKey)!.push(notification);
    });

    // Process each group
    for (const [groupKey, groupNotifications] of notificationGroups) {
      if (groupNotifications.length > 1) {
        console.log(`📦 Found ${groupNotifications.length} duplicate notifications for group: ${groupKey}`);

        // Sort by creation date (oldest first)
        groupNotifications.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Keep the oldest notification and delete the rest
        const [oldestNotification, ...duplicatesToDelete] = groupNotifications;

        // Delete duplicate notifications
        const duplicateIds = duplicatesToDelete.map((n) => n.id);
        await notificationRepo.delete(duplicateIds);

        console.log(`🗑️  Deleted ${duplicatesToDelete.length} duplicate notifications`);

        // Update the oldest notification to be bundled
        oldestNotification.isBundled = true;
        oldestNotification.bundleCount = groupNotifications.length;
        oldestNotification.bundleKey = groupKey;

        // Create bundled items array
        oldestNotification.bundledItems = groupNotifications.map((notification) => ({
          id: notification.id,
          userId: notification.userId,
          message: notification.message,
          actionId: notification.actionId,
          property: notification.property,
          createdAt: notification.createdAt,
        }));

        // Update the message to reflect the bundle count
        const type = oldestNotification.type;
        if (type === NotificationType.ENQUIRY) {
          oldestNotification.message = `You have ${groupNotifications.length} new property enquiries`;
        } else if (type === NotificationType.REVIEW) {
          oldestNotification.message = `You have ${groupNotifications.length} new reviews`;
        } else if (type === NotificationType.BOOST) {
          oldestNotification.message = `You have ${groupNotifications.length} new boost requests`;
        } else if (type === NotificationType.FOLLOW) {
          oldestNotification.message = `${groupNotifications.length} people started following you`;
        } else {
          oldestNotification.message = `You have ${groupNotifications.length} new ${type} notifications`;
        }

        // Save the updated bundled notification
        await notificationRepo.save(oldestNotification);

        console.log(`📦 Created bundled notification with ${groupNotifications.length} items`);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error cleaning up and bundling notifications:', error);
    return false;
  }
};

export const fetchNotifications = async (req: Request, res: Response) => {
  const { userId } = req.query;
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ success: false, message: 'userId is required as query param' });
  }

  try {
    const notificationRepository = AppDataSource.getRepository(Notifications);

    // Clean up duplicates and bundle notifications before fetching
    if (Number(page) === 1) {
      // Only cleanup on first page
      await cleanupAndBundleNotifications(userId);
    }

    // Get total count for pagination
    const totalCount = await notificationRepository.count({
      where: { userId },
    });

    // Get notifications with pagination
    const notifications = await notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: Number(limit),
    });

    // Generate presigned URLs for media files if they exist
    const notificationsWithUrls = await Promise.all(
      notifications.map(async (notification) => {
        // if (notification.mediakey) {
        //   notification.mediakey = await generatePresignedUrl(notification.mediakey);
        // }
        return notification;
      })
    );

    const totalPages = Math.ceil(totalCount / Number(limit));
    const hasMore = skip + notifications.length < totalCount;

    console.log(`📋 Fetched ${notifications.length} notifications for user ${userId} (page ${page})`);

    return res.status(200).json({
      success: true,
      notifications: notificationsWithUrls,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        hasMore,
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Enhanced generate notification function
export const generateNotification = async (
  userId: string,
  message: string,
  mediakey?: string,
  type?: NotificationType,
  user?: string,
  button?: string,
  property?: { title?: string; price?: string; location?: string; image?: string },
  status?: string,
  imageKey?: string,
  sound?: string,
  vibration?: string,
  actionId?: string
) => {
  try {
    const notificationRepo = AppDataSource.getRepository(Notifications);

    // Check for duplicate notification (within last 5 minutes)
    const existingNotification = await checkForDuplicateNotification(
      userId,
      message,
      type || NotificationType.OTHER,
      actionId
    );

    if (existingNotification) {
      console.log(`🔄 Duplicate generated notification prevented for user ${userId}: ${message}`);
      return [existingNotification, 'Notification already exists', 200];
    }

    const notification = notificationRepo.create({
      userId,
      message,
      mediakey,
      type,
      user,
      button,
      property,
      status,
      sound: sound || 'default',
      vibration: vibration || 'default',
      actionId,
    });

    // if (imageKey) {
    //   notification.mediakey = await generatePresignedUrl(imageKey);
    // }

    await notificationRepo.save(notification);

    // Send push notification
    const pushData = {
      notificationId: notification.id,
      type: notification.type,
      actionId: notification.actionId || '',
      ...notification.property,
    };

    const pushSent = await sendPushNotification(
      userId,
      type === 'welcome' ? 'Welcome to NextDeal!' : 'New Notification',
      message,
      pushData
    );

    // Emit real-time notification
    const realTimeSent = await emitRealTimeNotification(userId, notification);

    console.log(`🎯 Generated notification delivery summary for user ${userId}:`, {
      pushNotification: pushSent ? '✅ Sent' : '❌ Failed',
      realTimeNotification: realTimeSent ? '✅ Sent' : '⚠️  User not connected',
      notificationId: notification.id,
    });

    return [notification, 'Notification sent successfully', 200];
  } catch (error) {
    console.error('❌ Error generating notification:', error);
    return ['Failed to generate notification', 500];
  }
};

// Bundle notification function for creating social media style bundled notifications
export const bundleNotification = async (
  notifications: Array<{
    userId: string;
    message: string;
    mediakey?: string;
    type?: NotificationType;
    user?: string;
    button?: string;
    property?: { title?: string; price?: string; location?: string; image?: string };
    status?: string;
    imageKey?: string;
    sound?: string;
    vibration?: string;
    actionId?: string;
  }>,
  bundleWindowMinutes: number = 30 // Time window to group notifications
) => {
  try {
    const notificationRepo = AppDataSource.getRepository(Notifications);
    const results: Array<{
      success: boolean;
      notification?: Notifications;
      error?: string;
      userId: string;
      action: 'created' | 'updated' | 'skipped';
    }> = [];

    // Group notifications by userId and type for bundling
    const notificationGroups = new Map<string, Array<(typeof notifications)[0]>>();

    notifications.forEach((notification) => {
      const key = `${notification.userId}_${notification.type}`;
      if (!notificationGroups.has(key)) {
        notificationGroups.set(key, []);
      }
      notificationGroups.get(key)!.push(notification);
    });

    // Process each group
    for (const [groupKey, groupNotifications] of notificationGroups) {
      const [userId, type] = groupKey.split('_');

      try {
        // Check if there's an existing bundled notification within the time window
        const timeWindowAgo = new Date(Date.now() - bundleWindowMinutes * 60 * 1000);
        const bundleKey = `${userId}_${type}_${bundleWindowMinutes}`;

        const existingBundledNotification = await notificationRepo.findOne({
          where: {
            userId,
            type: type as NotificationType,
            isBundled: true,
            bundleKey,
            createdAt: MoreThanOrEqual(timeWindowAgo),
            isRead: false,
          },
          order: { createdAt: 'DESC' },
        });

        if (existingBundledNotification && groupNotifications.length > 1) {
          // Update existing bundled notification
          const newBundleCount = existingBundledNotification.bundleCount + groupNotifications.length;

          // Add new items to bundledItems array
          const newBundledItems = groupNotifications.map((notification) => ({
            id: Math.random().toString(36).substr(2, 9), // Generate temporary ID
            userId: notification.userId,
            message: notification.message,
            actionId: notification.actionId,
            property: notification.property,
            createdAt: new Date(),
          }));

          existingBundledNotification.bundleCount = newBundleCount;
          existingBundledNotification.bundledItems = [
            ...(existingBundledNotification.bundledItems || []),
            ...newBundledItems,
          ];

          // Update message based on bundle count
          if (type === 'enquiry') {
            existingBundledNotification.message = `You have ${newBundleCount} new property enquiries`;
          } else if (type === 'review') {
            existingBundledNotification.message = `You have ${newBundleCount} new reviews`;
          } else if (type === 'boost') {
            existingBundledNotification.message = `You have ${newBundleCount} new boost requests`;
          } else if (type === 'follow') {
            existingBundledNotification.message = `${newBundleCount} people started following you`;
          } else {
            existingBundledNotification.message = `You have ${newBundleCount} new ${type} notifications`;
          }

          await notificationRepo.save(existingBundledNotification);

          // Emit real-time notification update
          await emitRealTimeNotification(userId, existingBundledNotification);

          results.push({
            success: true,
            notification: existingBundledNotification,
            userId,
            action: 'updated',
          });

          console.log(
            `📦 Updated bundled notification for user ${userId}: ${newBundleCount} total ${type} notifications`
          );
        } else {
          // Create new notification (either individual or new bundle)
          if (groupNotifications.length === 1) {
            // Single notification - create individual notification
            const notificationData = groupNotifications[0];

            // Check for duplicate notification (within last 5 minutes)
            const existingNotification = await checkForDuplicateNotification(
              userId,
              notificationData.message,
              notificationData.type || NotificationType.OTHER,
              notificationData.actionId
            );

            if (existingNotification) {
              console.log(`🔄 Duplicate notification prevented for user ${userId}: ${notificationData.message}`);
              results.push({
                success: true,
                notification: existingNotification,
                userId,
                action: 'skipped',
              });
              continue;
            }

            const notification = notificationRepo.create({
              userId,
              message: notificationData.message,
              mediakey: notificationData.mediakey,
              type: notificationData.type,
              user: notificationData.user,
              button: notificationData.button,
              property: notificationData.property,
              status: notificationData.status,
              sound: notificationData.sound || 'default',
              vibration: notificationData.vibration || 'default',
              actionId: notificationData.actionId,
              isBundled: false,
              bundleCount: 1,
            });

            // if (notificationData.imageKey) {
            //   notification.mediakey = await generatePresignedUrl(notificationData.imageKey);
            // }

            await notificationRepo.save(notification);

            // Send push notification
            const pushData = {
              notificationId: notification.id,
              type: notification.type,
              actionId: notification.actionId || '',
              ...notification.property,
            };

            await sendPushNotification(
              userId,
              notificationData.type === 'welcome' ? 'Welcome to NextDeal!' : 'New Notification',
              notificationData.message,
              pushData
            );

            // Emit real-time notification
            await emitRealTimeNotification(userId, notification);

            results.push({
              success: true,
              notification,
              userId,
              action: 'created',
            });

            console.log(`📱 Created individual notification for user ${userId}: ${notificationData.message}`);
          } else {
            // Multiple notifications - create bundled notification
            const firstNotification = groupNotifications[0];
            const bundleKey = `${userId}_${type}_${bundleWindowMinutes}`;

            const bundledItems = groupNotifications.map((notification) => ({
              id: Math.random().toString(36).substr(2, 9), // Generate temporary ID
              userId: notification.userId,
              message: notification.message,
              actionId: notification.actionId,
              property: notification.property,
              createdAt: new Date(),
            }));

            let bundledMessage = '';
            if (type === 'enquiry') {
              bundledMessage = `You have ${groupNotifications.length} new property enquiries`;
            } else if (type === 'review') {
              bundledMessage = `You have ${groupNotifications.length} new reviews`;
            } else if (type === 'boost') {
              bundledMessage = `You have ${groupNotifications.length} new boost requests`;
            } else if (type === 'follow') {
              bundledMessage = `${groupNotifications.length} people started following you`;
            } else {
              bundledMessage = `You have ${groupNotifications.length} new ${type} notifications`;
            }

            const bundledNotification = notificationRepo.create({
              userId,
              message: bundledMessage,
              mediakey: firstNotification.mediakey,
              type: firstNotification.type,
              user: firstNotification.user,
              button: firstNotification.button,
              property: firstNotification.property,
              status: firstNotification.status,
              sound: firstNotification.sound || 'default',
              vibration: firstNotification.vibration || 'default',
              actionId: firstNotification.actionId,
              isBundled: true,
              bundleCount: groupNotifications.length,
              bundledItems,
              bundleKey,
            });

            // if (firstNotification.imageKey) {
            //   bundledNotification.mediakey = await generatePresignedUrl(firstNotification.imageKey);
            // }

            await notificationRepo.save(bundledNotification);

            // Send push notification
            const pushData = {
              notificationId: bundledNotification.id,
              type: bundledNotification.type,
              actionId: bundledNotification.actionId || '',
              isBundled: true,
              bundleCount: groupNotifications.length,
              ...bundledNotification.property,
            };

            await sendPushNotification(userId, 'New Notifications', bundledMessage, pushData);

            // Emit real-time notification
            await emitRealTimeNotification(userId, bundledNotification);

            results.push({
              success: true,
              notification: bundledNotification,
              userId,
              action: 'created',
            });

            console.log(
              `📦 Created bundled notification for user ${userId}: ${groupNotifications.length} ${type} notifications`
            );
          }
        }
      } catch (error) {
        console.error(`❌ Error processing notification group for user ${userId}:`, error);
        results.push({
          success: false,
          error: 'Failed to process notification group',
          userId,
          action: 'skipped',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;
    const createdCount = results.filter((r) => r.action === 'created').length;
    const updatedCount = results.filter((r) => r.action === 'updated').length;

    console.log(
      `📦 Bundle notification summary: ${successCount} successful, ${failureCount} failed, ${createdCount} created, ${updatedCount} updated out of ${notifications.length} total`
    );

    return {
      success: true,
      results,
      summary: {
        total: notifications.length,
        successful: successCount,
        failed: failureCount,
        created: createdCount,
        updated: updatedCount,
      },
    };
  } catch (error) {
    console.error('❌ Error in bundle notification:', error);
    return {
      success: false,
      error: 'Failed to process bundle notifications',
      results: [],
    };
  }
};

// Get delayed email job status (for monitoring)
export const getDelayedEmailStatus = async (req: Request, res: Response) => {
  try {
    const { delayedEmailService } = await import('@/common/utils/delayedEmailService');

    const pendingJobs = delayedEmailService.getPendingJobs();
    const jobCount = delayedEmailService.getJobCount();

    return res.status(200).json({
      success: true,
      data: {
        pendingJobs,
        jobCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ Error getting delayed email status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Example function demonstrating bundleNotification usage
export const sendBulkNotifications = async (req: Request, res: Response) => {
  try {
    const { userIds, message, type, property } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required and must not be empty',
      });
    }

    if (!message || !type) {
      return res.status(400).json({
        success: false,
        message: 'message and type are required',
      });
    }

    // Prepare notifications array for bundle processing
    const notificationsToSend = userIds.map((userId) => ({
      userId,
      message,
      type: type as NotificationType,
      property,
      status: 'Bulk Notification',
      sound: 'default',
      vibration: 'default',
    }));

    // Send all notifications in bundle
    const bundleResult = await bundleNotification(notificationsToSend);

    console.log('📦 Bulk notifications sent:', bundleResult.summary);

    return res.status(200).json({
      success: true,
      message: 'Bulk notifications sent successfully',
      summary: bundleResult.summary,
      results: bundleResult.results,
    });
  } catch (error) {
    console.error('❌ Error sending bulk notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// API endpoint for creating bundled notifications
export const createBundledNotifications = async (req: Request, res: Response) => {
  try {
    const { notifications, bundleWindowMinutes = 30 } = req.body;

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'notifications array is required and must not be empty',
      });
    }

    // Send notifications using bundle function
    const bundleResult = await bundleNotification(notifications, bundleWindowMinutes);

    console.log('📦 Bundled notifications created:', bundleResult.summary);

    return res.status(200).json({
      success: true,
      message: 'Bundled notifications created successfully',
      summary: bundleResult.summary,
      results: bundleResult.results,
    });
  } catch (error) {
    console.error('❌ Error creating bundled notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// API endpoint for getting bundled notification details
export const getBundledNotificationDetails = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: 'notificationId is required',
      });
    }

    const notificationRepository = AppDataSource.getRepository(Notifications);
    const notification = await notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    if (!notification.isBundled) {
      return res.status(400).json({
        success: false,
        message: 'This is not a bundled notification',
      });
    }

    // Generate presigned URLs for bundled items if they have media
    // const bundledItemsWithUrls =
    //   notification.bundledItems?.map((item) => ({
    //     ...item,
    //     property: item.property
    //       ? {
    //           ...item.property,
    //           image: item.property.image ? generatePresignedUrl(item.property.image) : undefined,
    //         }
    //       : undefined,
    //   })) || [];

    return res.status(200).json({
      success: true,
      notification: {
        ...notification,
        // bundledItems: bundledItemsWithUrls,
      },
    });
  } catch (error) {
    console.error('❌ Error getting bundled notification details:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Test function to demonstrate bundled notifications
export const testBundledNotifications = async (req: Request, res: Response) => {
  try {
    const { userId, propertyId } = req.body;

    if (!userId || !propertyId) {
      return res.status(400).json({
        success: false,
        message: 'userId and propertyId are required',
      });
    }

    // Create multiple property enquiries to demonstrate bundling
    const testNotifications = [];

    // Create 5 property enquiries to the same user
    for (let i = 1; i <= 5; i++) {
      testNotifications.push({
        userId,
        message: `You have a new property enquiry for Property ${i}`,
        type: NotificationType.ENQUIRY,
        user: `Property ${i}`,
        button: 'View Enquiry',
        property: {
          title: `Test Property ${i}`,
          price: `₹${1000000 + i * 100000}`,
          location: `Location ${i}`,
          image: '',
        },
        status: 'Enquiry',
        actionId: `${propertyId}_${i}`,
        sound: 'default',
        vibration: 'default',
      });
    }

    // Send notifications with bundling (30 minute window)
    const bundleResult = await bundleNotification(testNotifications, 30);

    console.log('🧪 Test bundled notifications result:', bundleResult.summary);

    return res.status(200).json({
      success: true,
      message: 'Test bundled notifications created successfully',
      summary: bundleResult.summary,
      results: bundleResult.results,
      explanation:
        'This demonstrates how multiple similar notifications get grouped into a single bundled notification, similar to social media platforms.',
    });
  } catch (error) {
    console.error('❌ Error in test bundled notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Test function to demonstrate Instagram-style follow notification bundling
export const testFollowNotificationBundling = async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'targetUserId is required',
      });
    }

    // Create multiple follow notifications to demonstrate Instagram-style bundling
    const testFollowNotifications = [];

    // Create 5 follow notifications from different users
    const fakeUsers = ['John Doe', 'Sarah Smith', 'Mike Johnson', 'Lisa Brown', 'Alex Wilson'];

    for (let i = 0; i < 5; i++) {
      testFollowNotifications.push({
        userId: targetUserId,
        message: `${fakeUsers[i]} started following you`,
        type: NotificationType.FOLLOW,
        user: fakeUsers[i],
        button: 'View Profile',
        property: undefined,
        status: 'New Follower',
        actionId: `user_${i + 1}`, // Simulate different user IDs
        sound: 'default',
        vibration: 'default',
      });
    }

    // Send notifications with bundling (30 minute window)
    const bundleResult = await bundleNotification(testFollowNotifications, 30);

    console.log('📱 Instagram-style follow notification bundling result:', bundleResult.summary);

    return res.status(200).json({
      success: true,
      message: 'Instagram-style follow notification bundling test completed',
      summary: bundleResult.summary,
      results: bundleResult.results,
      explanation:
        'This demonstrates how multiple follow notifications get bundled into a single notification, just like Instagram.',
    });
  } catch (error) {
    console.error('❌ Error in follow notification bundling test:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Manual cleanup endpoint for testing
export const manualCleanupNotifications = async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  try {
    const result = await cleanupAndBundleNotifications(userId);

    if (result) {
      return res.status(200).json({
        success: true,
        message: 'Notifications cleaned up and bundled successfully',
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to cleanup notifications',
      });
    }
  } catch (error) {
    console.error('❌ Error in manual cleanup:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
