import { Request, Response } from 'express';
import { IsNull, LessThan, MoreThanOrEqual } from 'typeorm';

import { UserAuth } from '@/api/entity/UserAuth';
import { AppDataSource } from '@/server';
import { getSocketInstance } from '@/socket';

// Interface for user statistics response
interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  userTypeBreakdown: {
    Agent: number;
    Owner: number;
    EndUser: number;
    Investor: number;
  };
  verificationStatus: {
    emailVerified: number;
    mobileVerified: number;
    fullyVerified: number;
    notVerified: number;
  };
  lastActivityBreakdown: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    last90Days: number;
    olderThan90Days: number;
  };
}

// Interface for user list response
interface UserListResponse {
  users: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Get total users count
export const getTotalUsers = async (_req: Request, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(UserAuth);

    const totalUsers = await userRepo.count();

    return res.status(200).json({
      success: true,
      message: 'Total users count retrieved successfully',
      data: {
        totalUsers,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in getTotalUsers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get total users count',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get active users count (users who have been active in last 30 days)
export const getActiveUsers = async (_req: Request, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get users who have been active in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await userRepo.count({
      where: {
        updatedAt: MoreThanOrEqual(thirtyDaysAgo),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Active users count retrieved successfully',
      data: {
        activeUsers,
        lastActivityThreshold: thirtyDaysAgo.toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in getActiveUsers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active users count',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get inactive users count (users who haven't been active in last 30 days)
export const getInactiveUsers = async (_req: Request, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get users who haven't been active in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inactiveUsers = await userRepo.count({
      where: [
        {
          updatedAt: LessThan(thirtyDaysAgo),
        },
        {
          updatedAt: IsNull(),
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: 'Inactive users count retrieved successfully',
      data: {
        inactiveUsers,
        lastActivityThreshold: thirtyDaysAgo.toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in getInactiveUsers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get inactive users count',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get comprehensive user statistics
export const getUserStatistics = async (_req: Request, res: Response) => {
  try {
    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get total users
    const totalUsers = await userRepo.count();

    // Get active users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await userRepo.count({
      where: {
        updatedAt: MoreThanOrEqual(thirtyDaysAgo),
      },
    });

    const inactiveUsers = totalUsers - activeUsers;

    // Get user type breakdown
    const userTypeBreakdown = await userRepo
      .createQueryBuilder('user')
      .select('user.userType', 'userType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.userType')
      .getRawMany();

    const userTypeMap = {
      Agent: 0,
      Owner: 0,
      EndUser: 0,
      Investor: 0,
    };

    userTypeBreakdown.forEach((item) => {
      if (item.userType && userTypeMap.hasOwnProperty(item.userType)) {
        userTypeMap[item.userType as keyof typeof userTypeMap] = parseInt(item.count);
      }
    });

    // Get verification status breakdown
    const emailVerified = await userRepo.count({
      where: { isEmailVerified: true },
    });

    const mobileVerified = await userRepo.count({
      where: { isMobileVerified: true },
    });

    const fullyVerified = await userRepo.count({
      where: {
        isEmailVerified: true,
        isMobileVerified: true,
      },
    });

    const notVerified = totalUsers - fullyVerified;

    // Get last activity breakdown
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const last24HoursCount = await userRepo.count({
      where: {
        updatedAt: MoreThanOrEqual(last24Hours),
      },
    });

    const last7DaysCount = await userRepo.count({
      where: {
        updatedAt: MoreThanOrEqual(last7Days),
      },
    });

    const last30DaysCount = await userRepo.count({
      where: {
        updatedAt: MoreThanOrEqual(last30Days),
      },
    });

    const last90DaysCount = await userRepo.count({
      where: {
        updatedAt: MoreThanOrEqual(last90Days),
      },
    });

    const olderThan90DaysCount = totalUsers - last90DaysCount;

    const statistics: UserStatistics = {
      totalUsers,
      activeUsers,
      inactiveUsers,
      userTypeBreakdown: userTypeMap,
      verificationStatus: {
        emailVerified,
        mobileVerified,
        fullyVerified,
        notVerified,
      },
      lastActivityBreakdown: {
        last24Hours: last24HoursCount,
        last7Days: last7DaysCount,
        last30Days: last30DaysCount,
        last90Days: last90DaysCount,
        olderThan90Days: olderThan90DaysCount,
      },
    };

    return res.status(200).json({
      success: true,
      message: 'User statistics retrieved successfully',
      data: statistics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in getUserStatistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get currently online users (using socket connections)
export const getOnlineUsers = async (_req: Request, res: Response) => {
  try {
    const io = getSocketInstance();
    const connectedUsers = io.sockets.adapter.rooms;

    // Filter out system rooms (socket.io creates some default rooms)
    const userRooms = Array.from(connectedUsers.keys()).filter(
      (roomId) => roomId !== roomId && !roomId.startsWith('socket_')
    );

    const onlineUsersCount = userRooms.length;

    return res.status(200).json({
      success: true,
      message: 'Online users count retrieved successfully',
      data: {
        onlineUsers: onlineUsersCount,
        activeRooms: userRooms,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in getOnlineUsers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get online users count',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get list of active users with pagination
export const getActiveUsersList = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, userType } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get users who have been active in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const whereCondition: any = {
      updatedAt: MoreThanOrEqual(thirtyDaysAgo),
    };

    if (userType) {
      whereCondition.userType = userType;
    }

    // Get total count
    const totalCount = await userRepo.count({
      where: whereCondition,
    });

    // Get users with pagination
    const users = await userRepo.find({
      where: whereCondition,
      select: [
        'id',
        'fullName',
        'email',
        'mobileNumber',
        'userType',
        'isEmailVerified',
        'isMobileVerified',
        'createdAt',
        'updatedAt',
        'profileImg',
        'isSignedUp',
        'googleId',
      ],
      order: { updatedAt: 'DESC' },
      skip,
      take: Number(limit),
    });

    const totalPages = Math.ceil(totalCount / Number(limit));

    const response: UserListResponse = {
      users: users.map((user) => ({
        id: user.id,
        fullName: user.fullName || 'N/A',
        email: user.email || 'N/A',
        mobileNumber: user.mobileNumber || 'N/A',
        userType: user.userType || 'N/A',
        isEmailVerified: user.isEmailVerified,
        isMobileVerified: user.isMobileVerified,
        isFullyVerified: user.isEmailVerified && user.isMobileVerified,
        profileImg: user.profileImg || null,
        profileUrl: user.profileImg || null, // Alias for profileImg
        isSignedUp: user.isSignedUp,
        googleId: user.googleId || null,
        createdAt: user.createdAt,
        lastActivity: user.updatedAt,
        daysActive: user.updatedAt
          ? Math.floor((new Date().getTime() - new Date(user.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages,
      },
    };

    return res.status(200).json({
      success: true,
      message: 'Active users list retrieved successfully',
      data: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in getActiveUsersList:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active users list',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get list of inactive users with pagination
export const getInactiveUsersList = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, userType } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const userRepo = AppDataSource.getRepository(UserAuth);

    // Get users who haven't been active in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const whereCondition: any = [
      {
        updatedAt: LessThan(thirtyDaysAgo),
      },
      {
        updatedAt: IsNull(),
      },
    ];

    if (userType) {
      whereCondition.forEach((condition: any) => {
        condition.userType = userType;
      });
    }

    // Get total count
    const totalCount = await userRepo.count({
      where: whereCondition,
    });

    // Get users with pagination
    const users = await userRepo.find({
      where: whereCondition,
      select: [
        'id',
        'fullName',
        'email',
        'mobileNumber',
        'userType',
        'isEmailVerified',
        'isMobileVerified',
        'createdAt',
        'updatedAt',
        'profileImg',
        'isSignedUp',
        'googleId',
      ],
      order: { updatedAt: 'ASC' },
      skip,
      take: Number(limit),
    });

    const totalPages = Math.ceil(totalCount / Number(limit));

    const response: UserListResponse = {
      users: users.map((user) => ({
        id: user.id,
        fullName: user.fullName || 'N/A',
        email: user.email || 'N/A',
        mobileNumber: user.mobileNumber || 'N/A',
        userType: user.userType || 'N/A',
        isEmailVerified: user.isEmailVerified,
        isMobileVerified: user.isMobileVerified,
        isFullyVerified: user.isEmailVerified && user.isMobileVerified,
        profileImg: user.profileImg || null,
        profileUrl: user.profileImg || null, // Alias for profileImg
        isSignedUp: user.isSignedUp,
        googleId: user.googleId || null,
        createdAt: user.createdAt,
        lastActivity: user.updatedAt,
        daysInactive: user.updatedAt
          ? Math.floor((new Date().getTime() - new Date(user.updatedAt).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        totalPages,
      },
    };

    return res.status(200).json({
      success: true,
      message: 'Inactive users list retrieved successfully',
      data: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in getInactiveUsersList:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get inactive users list',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
