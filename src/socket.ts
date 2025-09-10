import { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;
const connectedUsers = new Map<string, string[]>(); // userId -> socketIds[]

export const initializeSocket = (app: Express) => {
  const httpServer = createServer(app);
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    pingTimeout: 30000, // Reduced from 60000 to 30000
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    maxHttpBufferSize: 1e6, // 1MB
    connectTimeout: 45000, // 45 seconds
    upgradeTimeout: 10000, // 10 seconds
  });

  io.on('connection', (socket: any) => {
    console.log('🟢 New client connected:', socket.id);

    // Set socket timeout
    socket.conn.on('packet', ({ type }: any) => {
      if (type === 'pong') {
        socket.conn.resetIdleTimer();
      }
    });

    // Join user room for notifications
    socket.on('joinRoom', (userId: string) => {
      try {
        if (!userId || typeof userId !== 'string') {
          console.warn('⚠️  Invalid userId provided for joinRoom:', userId);
          socket.emit('error', { message: 'Invalid userId provided' });
          return;
        }

        socket.join(userId);

        // Track connected users
        if (!connectedUsers.has(userId)) {
          connectedUsers.set(userId, []);
        }
        connectedUsers.get(userId)!.push(socket.id);

        console.log(`👤 User ${userId} joined their room (socket: ${socket.id})`);
        console.log(`📊 Total sockets for user ${userId}:`, connectedUsers.get(userId)?.length);

        // Send confirmation message
        socket.emit('roomJoined', {
          message: `Successfully joined room for user ${userId}`,
          userId,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });

        // Log all rooms this socket is in
        const rooms = Array.from(socket.rooms);
        console.log(`🏠 Socket ${socket.id} is now in rooms:`, rooms);
      } catch (error) {
        console.error('❌ Error in joinRoom:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave user room
    socket.on('leaveRoom', (userId: string) => {
      try {
        if (!userId || typeof userId !== 'string') {
          console.warn('⚠️  Invalid userId provided for leaveRoom:', userId);
          return;
        }

        socket.leave(userId);

        // Remove from tracking
        const userSockets = connectedUsers.get(userId);
        if (userSockets) {
          const index = userSockets.indexOf(socket.id);
          if (index > -1) {
            userSockets.splice(index, 1);
            if (userSockets.length === 0) {
              connectedUsers.delete(userId);
            }
          }
        }

        console.log(`👋 User ${userId} left their room (socket: ${socket.id})`);
        socket.emit('roomLeft', {
          message: `Left room for user ${userId}`,
          userId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('❌ Error in leaveRoom:', error);
      }
    });

    // Broadcast message to all clients
    socket.on('broadcastMessage', (message: any) => {
      try {
        console.log('📢 Broadcasting message:', message);
        io.emit('receiveBroadcast', {
          message,
          timestamp: new Date().toISOString(),
          sender: socket.id,
        });
      } catch (error) {
        console.error('❌ Error broadcasting message:', error);
        socket.emit('error', { message: 'Failed to broadcast message' });
      }
    });

    // Broadcast message to a specific room
    socket.on('broadcastToRoom', ({ roomId, message }: any) => {
      try {
        if (!roomId || !message) {
          socket.emit('error', { message: 'roomId and message are required' });
          return;
        }

        console.log(`📢 Broadcasting to room ${roomId}:`, message);
        socket.to(roomId).emit('receiveRoomBroadcast', {
          roomId,
          message,
          timestamp: new Date().toISOString(),
          sender: socket.id,
        });
      } catch (error) {
        console.error('❌ Error broadcasting to room:', error);
        socket.emit('error', { message: 'Failed to broadcast to room' });
      }
    });

    // Handle notification acknowledgment
    socket.on('notificationAcknowledged', (notificationId: string) => {
      try {
        console.log(`✅ Notification ${notificationId} acknowledged by socket ${socket.id}`);
        socket.emit('acknowledgmentReceived', {
          notificationId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('❌ Error handling notification acknowledgment:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason: any) => {
      console.log(`🔴 Client disconnected: ${socket.id} (reason: ${reason})`);

      // Clean up user tracking
      for (const [userId, sockets] of connectedUsers.entries()) {
        const index = sockets.indexOf(socket.id);
        if (index > -1) {
          sockets.splice(index, 1);
          if (sockets.length === 0) {
            connectedUsers.delete(userId);
            console.log(`🧹 Cleaned up user ${userId} - no more active connections`);
          }
        }
      }
    });

    // Handle connection errors
    socket.on('error', (error: any) => {
      console.error('❌ Socket error:', error);
    });
  });

  return httpServer;
};

// Enhanced broadcast message function
export const broadcastMessage = (req: Request, res: Response) => {
  const { message, targetUsers } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    if (targetUsers && Array.isArray(targetUsers)) {
      // Broadcast to specific users
      targetUsers.forEach((userId) => {
        io.to(userId).emit('receiveBroadcast', {
          message,
          timestamp: new Date().toISOString(),
          targetUser: userId,
        });
      });
      console.log(`📢 Broadcast sent to ${targetUsers.length} specific users`);
    } else {
      // Broadcast to all users
      io.emit('receiveBroadcast', {
        message,
        timestamp: new Date().toISOString(),
      });
      console.log('📢 Broadcast sent to all users');
    }

    return res.status(200).json({
      status: 'success',
      message: 'Broadcast sent',
      targetUsers: targetUsers || 'all',
    });
  } catch (error) {
    console.error('❌ Error in broadcastMessage:', error);
    return res.status(500).json({ error: 'Failed to send broadcast' });
  }
};

// Enhanced test socket connection function
export const testSocketConnection = (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const io = getSocketInstance();

    // Get all sockets in the user's room
    const room = io.sockets.adapter.rooms.get(userId as string);
    const connectedUsersInRoom = room ? Array.from(room) : [];
    const userSockets = connectedUsers.get(userId as string) || [];

    console.log(`🧪 Testing socket connection for user ${userId}`);
    console.log(`👥 Connected users in room:`, connectedUsersInRoom);
    console.log(`📱 User's tracked sockets:`, userSockets);

    // Send a test message to the user's room
    io.to(userId as string).emit('test', {
      message: 'Test message from server',
      timestamp: new Date().toISOString(),
      connectedUsers: connectedUsersInRoom,
      userSockets,
      roomExists: !!room,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Test message sent',
      connectedUsers: connectedUsersInRoom,
      userSockets,
      roomExists: !!room,
      totalConnectedUsers: connectedUsers.size,
    });
  } catch (error) {
    console.error('❌ Error testing socket connection:', error);
    return res.status(500).json({ error: 'Socket server error' });
  }
};

// Get socket statistics
export const getSocketStats = (req: Request, res: Response) => {
  try {
    const stats = {
      totalConnectedUsers: connectedUsers.size,
      totalSockets: io.engine.clientsCount,
      connectedUsers: Object.fromEntries(connectedUsers),
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json({
      status: 'success',
      stats,
    });
  } catch (error) {
    console.error('❌ Error getting socket stats:', error);
    return res.status(500).json({ error: 'Failed to get socket stats' });
  }
};

// Send notification to specific user
export const sendNotificationToUser = (userId: string, notificationData: any) => {
  try {
    if (!io) {
      console.error('❌ Socket.IO server not initialized');
      return false;
    }

    const userSockets = connectedUsers.get(userId);
    if (!userSockets || userSockets.length === 0) {
      console.log(`⚠️  No active connections for user ${userId}`);
      return false;
    }

    io.to(userId).emit('notifications', {
      ...notificationData,
      timestamp: new Date().toISOString(),
      socketCount: userSockets.length,
    });

    console.log(`📨 Notification sent to user ${userId} via ${userSockets.length} socket(s)`);
    return true;
  } catch (error) {
    console.error('❌ Error sending notification to user:', error);
    return false;
  }
};

export const getSocketInstance = () => {
  if (!io) {
    console.error('❌ Socket.IO server not initialized');
    throw new Error('Socket.IO server not initialized');
  }
  return io;
};
