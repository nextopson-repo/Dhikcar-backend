// import 'reflect-metadata';
import { networkInterfaces } from 'os';

import { env } from '@/common/utils/envConfig';
import { httpServer, logger } from '@/server';

// Function to get local IP address
const getLocalIP = (): string => {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (interfaces) {
      for (const net of interfaces) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }
  return 'localhost';
};

// Enhanced error handling and restart logic
let restartCount = 0;
const MAX_RESTARTS = 10;
const RESTART_DELAY = 5000; // 5 seconds

const startServer = () => {
  try {
    const server = httpServer.listen(env.PORT || 5000, () => {
      const { NODE_ENV, PORT } = env;

      // Get actual local IP address
      const HOST = getLocalIP();

      logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
      logger.info(`Swagger docs available at http://${HOST}:${PORT}/api-docs`);
      logger.info(`Socket.IO server is running on the same port`);

      // Reset restart count on successful start
      restartCount = 0;
    });

    // Enhanced error handling for server
    server.on('error', (error: any) => {
      logger.error('Server error occurred:', error);

      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${env.PORT || 5000} is already in use`);
        process.exit(1);
      } else {
        logger.error('Unexpected server error, attempting restart...');
        handleRestart();
      }
    });

    // Connection error handling
    server.on('connection', (socket) => {
      socket.on('error', (error: any) => {
        logger.error('Socket error:', error);
      });
    });

    const onCloseSignal = () => {
      logger.info('Shutdown signal received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed gracefully');
        process.exit(0);
      });

      // Force exit after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGINT', onCloseSignal);
    process.on('SIGTERM', onCloseSignal);

    return server;
  } catch (error: any) {
    logger.error('Failed to start server:', error);
    handleRestart();
  }
};

// Restart logic with exponential backoff
const handleRestart = () => {
  restartCount++;

  if (restartCount > MAX_RESTARTS) {
    logger.error(`Maximum restart attempts (${MAX_RESTARTS}) reached. Exiting...`);
    process.exit(1);
  }

  const delay = Math.min(RESTART_DELAY * Math.pow(2, restartCount - 1), 30000); // Max 30 seconds

  logger.info(`Restarting server in ${delay}ms (attempt ${restartCount}/${MAX_RESTARTS})`);

  setTimeout(() => {
    logger.info('Attempting server restart...');
    startServer();
  }, delay);
};

// Enhanced process error handling
process.on('uncaughtException', (error: any) => {
  logger.error('Uncaught Exception:', error);
  logger.error('Stack trace:', error.stack);

  // Attempt restart for recoverable errors
  if (restartCount < MAX_RESTARTS) {
    logger.info('Attempting restart due to uncaught exception...');
    handleRestart();
  } else {
    logger.error('Maximum restart attempts reached, exiting...');
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  // logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error(promise, reason);

  // Attempt restart for recoverable errors
  if (restartCount < MAX_RESTARTS) {
    logger.info('Attempting restart due to unhandled rejection...');
    handleRestart();
  } else {
    logger.error('Maximum restart attempts reached, exiting...');
    process.exit(1);
  }
});

// Memory leak detection
const checkMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
  };

  // logger.info('Memory usage:', memUsageMB);

  // Restart if memory usage is too high (over 1GB heap used)
  if (memUsageMB.heapUsed > 1024) {
    logger.warn('High memory usage detected, restarting server...');
    handleRestart();
  }
};

// Check memory usage every 5 minutes
setInterval(checkMemoryUsage, 5 * 60 * 1000);

// Health check endpoint for monitoring
process.on('message', (message) => {
  if (message === 'health_check') {
    process.send?.('healthy');
  }
});

// Start the server
startServer();
