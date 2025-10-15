import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import { pino } from 'pino';
import { DataSource, DataSourceOptions } from 'typeorm';
import errorHandler from '@/common/middleware/errorHandler';
import requestLogger from '@/common/middleware/requestLogger';
import { UserCredibility } from './api/entity/Credibility';
import { Address } from './api/entity/Address';
import { BlockUser } from './api/entity/BlockUser';
import { CarDetails } from './api/entity/CarDetails';
import { CarEnquiry } from './api/entity/CarEnquiry';
import { CarReport } from './api/entity/CarReport';
import { CarRequirement } from './api/entity/CarRequirement';
import { Connections } from './api/entity/Connection';
import { DropdownOptions } from './api/entity/DropdownOptions';
import { IndianCity } from './api/entity/IndianCity';
import { Location } from './api/entity/Location';
import { Notifications } from './api/entity/Notifications';
import { RepublishCarDetails } from './api/entity/RepublishCars';
import { RequirementEnquiry } from './api/entity/RequirementEnquiry';
import { SavedCar } from './api/entity/SavedCars';
import { UserAuth } from './api/entity/UserAuth';
import { UserKyc } from './api/entity/userkyc';
import { UserLocation } from './api/entity/UserLocation';
import { UserReport } from './api/entity/UserReport';
import { UserReview } from './api/entity/UserReview';
import appleOAuthRoutes from './api/routes/auth/AppleOAuthRoutes';
import authRoutes from './api/routes/auth/AuthRoutes';
import googleOAuthRoutes from './api/routes/auth/GoogleOAuthRoutes';
import s3bucket from './api/routes/aws/s3';
import ConnectionRoutes from './api/routes/connection/ConnectionRoutes';
import DashboardRoute from './api/routes/dashboardRoutes/DashboardRoutes';
import republishRoutes from './api/routes/dashboardRoutes/republishedRoute';
import DropDownRouter from './api/routes/dropDown/dropdown';
import kycProcessRoutes from './api/routes/kycProcess/kycProcessRoutes';
import NotificationRoutes from './api/routes/notificationsRoutes/NotificationRoutes';
import SocketNotificationRoute from './api/routes/notificationsRoutes/SocketNotificationRoute';
import car from './api/routes/CarRoutes/CarRoute';
import reviewRoutes from './api/routes/review/reviewRoute';
import Profile from './api/routes/UpdateProfileRoute/updateProfileRoute';
import UserLocationRoutes from './api/routes/User/UserLocationRoutes';
import UserStatisticsRoutes from './api/routes/User/UserStatisticsRoutes';
import tempRoutes from './api/temp/tempRoutes';
import { initializeSocket } from './socket';

const logger = pino({ name: 'server start' });
const app: Express = express();

// Database configuration
const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.NODE_ENV === 'production' ? process.env.LOCAL_DB_HOST : 'srv834.hstgr.io',
  port: process.env.NODE_ENV === 'production' ? process.env.LOCAL_DB_PORT : '3306',
  username: process.env.NODE_ENV === 'production' ? process.env.LOCAL_DB_USERNAME : 'u595570778_dhikcar',
  password: process.env.NODE_ENV === 'production' ? process.env.LOCAL_DB_PASSWORD : 'Dhikcar-web333',
  database: process.env.NODE_ENV === 'production' ? process.env.LOCAL_DB_NAME : 'u595570778_dhikcarweb333',

  entities: [
    UserAuth,
    CarDetails,
    Address,
    UserCredibility,
    SavedCar,
    CarRequirement,
    DropdownOptions,
    UserKyc,
    RepublishCarDetails,
    Location,
    CarEnquiry,
    Notifications,
    UserReview,
    RequirementEnquiry,
    Connections,
    BlockUser,
    UserReport,
    UserLocation,
    IndianCity,
    CarReport,
  ],
  synchronize: true,
  logging: false,
  entitySkipConstructor: false,
  extra: { connectionLimit: 10 },
};

const AppDataSource = new DataSource(dataSourceOptions);

// Middlewares
app.set('trust proxy', true);
app.use(express.json({ limit: '1024mb' }));
app.use(express.urlencoded({ extended: true, limit: '1024mb' }));
app.use(cookieParser());
app.use(cors({ origin: (_, cb) => cb(null, true), credentials: true }));
app.use(helmet());
app.use(requestLogger);

// Timeout middleware
app.use((req: Request, res: Response, next) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      logger.error(`Request timeout for ${req.method} ${req.url}`);
      res.status(408).json({ status: 'error', message: 'Request timeout', path: req.url, method: req.method });
    }
  }, 350000);
  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
  next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/google', googleOAuthRoutes);
app.use('/api/v1/auth/apple', appleOAuthRoutes);
app.use('/api/v1/s3', s3bucket);
app.use('/api/v1/car', car);
app.use('/api/v1/profile', Profile);
app.use('/api/v1/dropdown', DropDownRouter);
app.use('/api/v1/kyc', kycProcessRoutes);
app.use('/api/v1/dashboard', DashboardRoute);
app.use('/api/v1/republish', republishRoutes);
app.use('/api/v1/notification', NotificationRoutes);
app.use('/api/v1/connection', ConnectionRoutes);
app.use('/api/v1/notification', SocketNotificationRoute);
app.use('/api/v1/review', reviewRoutes);
app.use('/api/v1/user-location', UserLocationRoutes);
app.use('/api/v1/user-statistics', UserStatisticsRoutes);
app.use('/api/v1/temp', tempRoutes);

// Basic routes
app.get('/', (req, res) => res.send('Welcome to Dhikcar'));
app.post('/api/v1/user-message', (req, res) => {
  res.json({ message: "India's #1 Car Marketplace Deals Website" });
});

// Health endpoints
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: AppDataSource.isInitialized ? 'connected' : 'disconnected',
  });
});

app.get('/health/deep', async (req, res) => {
  try {
    if (!AppDataSource.isInitialized) throw new Error('Database not connected');
    await AppDataSource.query('SELECT 1 as test');
    res.status(200).json({ status: 'OK', message: 'All systems operational', timestamp: new Date().toISOString() });
  } catch (error: any) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Render-specific health check endpoint
app.get('/health/ready', (req, res) => {
  if (AppDataSource.isInitialized) {
    res.status(200).json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

// Error handler
app.use(errorHandler());

// HTTP server + Socket
const httpServer = initializeSocket(app);
httpServer.timeout = 30000;
httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;

// Set max listeners to prevent memory leak warnings
process.setMaxListeners(0);

// Handle connection cleanup to prevent memory leaks
httpServer.on('connection', (socket) => {
  socket.setMaxListeners(0);
  socket.on('close', () => {
    // Clean up any remaining listeners
    socket.removeAllListeners();
  });
});

// Database connection with retry logic
let dbRetryCount = 0;
const MAX_DB_RETRIES = 5;
const DB_RETRY_DELAY = 5000;

const initializeDatabase = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Database connected!');
      dbRetryCount = 0;
    }
  } catch (error: any) {
    logger.error('Database connection failed:', error);
    dbRetryCount++;
    if (dbRetryCount < MAX_DB_RETRIES) {
      logger.info(`Retrying database connection (${dbRetryCount}/${MAX_DB_RETRIES}) in ${DB_RETRY_DELAY}ms`);
      setTimeout(initializeDatabase, DB_RETRY_DELAY);
    } else {
      logger.error('Max retries reached, exiting.');
      process.exit(1);
    }
  }
};

// Database heartbeat
setInterval(async () => {
  try {
    if (AppDataSource.isInitialized) await AppDataSource.query('SELECT 1 as heartbeat');
    else {
      logger.warn('Database connection lost, attempting reconnect...');
      await initializeDatabase();
    }
  } catch (error: any) {
    logger.error('Database heartbeat failed:', error);
    try {
      await AppDataSource.destroy();
      await initializeDatabase();
    } catch (reconnectError: any) {
      logger.error('Failed to reconnect:', reconnectError);
    }
  }
}, 30000);

initializeDatabase();

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal');
  if (httpServer) httpServer.close(() => logger.info('HTTP server closed'));
  if (AppDataSource.isInitialized) {
    try {
      await AppDataSource.destroy();
      logger.info('Database connection closed');
    } catch (error: any) {
      logger.error('Error closing DB:', error);
    }
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Exception handling
process.on('uncaughtException', (error: any) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  // logger.error(`Unhandled Rejection: ${reason}`, { promise });
  process.exit(1);
});

export { app, AppDataSource, httpServer, logger };