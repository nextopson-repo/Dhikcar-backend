import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import { pino } from 'pino';
import swaggerUi from 'swagger-ui-express';
import { DataSource, DataSourceOptions } from 'typeorm';
import errorHandler from '@/common/middleware/errorHandler';
import requestLogger from '@/common/middleware/requestLogger';
import { UserCredibility } from './api/entity/Credibility';
import { Address } from './api/entity/Address';
import { BlockUser } from './api/entity/BlockUser';
import { CarDetails } from './api/entity/CarDetails';
import { CarEnquiry } from './api/entity/CarEnquiry';
import { CarImages } from './api/entity/CarImages';
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
import { swaggerSpec } from './config/swagger';
import { initializeSocket } from './socket';

const logger = pino({ name: 'server start' });
const app: Express = express();

// DataSource options
// const dataSourceOptions: DataSourceOptions = {
//   type: 'mysql',
//   host: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_HOST : process.env.LOCAL_DB_HOST,
//   port: 3306,
//   username: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_USERNAME : process.env.LOCAL_DB_USERNAME,
//   password: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_PASSWORD : process.env.LOCAL_DB_PASSWORD,
//   database: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_DB_NAME : process.env.LOCAL_DB_NAME,
//   entities: [
//     UserAuth,
//     CarDetails,
//     Address,
//     UserCredibility,
//     SavedCar,
//     CarRequirement,
//     DropdownOptions,
//     UserKyc,
//     RepublishCarDetails,
//     CarImages,
//     Location,
//     CarEnquiry,
//     Notifications,
//     UserReview,
//     RequirementEnquiry,
//     Connections,
//     BlockUser,
//     UserReport,
//     UserLocation,
//     IndianCity,
//     CarReport,
//   ],
//   synchronize: true,
//   logging: false,
//   entitySkipConstructor: false,
//   extra: { connectionLimit: 10 },
// };
const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.NODE_ENV === 'production' ? process.env.RAILWAY_DB_HOST : 'gondola.proxy.rlwy.net',
  port: process.env.NODE_ENV === 'production' ? Number(process.env.RAILWAY_DB_PORT) : '14576',
  username: process.env.NODE_ENV === 'production' ? process.env.RAILWAY_DB_USERNAME : 'root',
  password: process.env.NODE_ENV === 'production' ? process.env.RAILWAY_DB_PASSWORD : 'OgrreFUGzPujpeHqzGKuunqZCsKvZYfX',
  database: process.env.NODE_ENV === 'production' ? process.env.RAILWAY_DB_NAME : 'railway',
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
    CarImages,
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

// Swagger setup
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'NextDeal API Documentation',
  })
);

// Middlewares
app.set('trust proxy', true);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
  }, 35000);
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

// Error handler
app.use(errorHandler());

// HTTP server + Socket
const httpServer = initializeSocket(app);
httpServer.timeout = 30000;
httpServer.keepAliveTimeout = 65000;
httpServer.headersTimeout = 66000;

// DB connection with retry logic
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

// DB heartbeat
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

// Exceptions handling
process.on('uncaughtException', (error: any) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason, promise);
  process.exit(1);
});

export { app, AppDataSource, httpServer, logger };

// import cookieParser from 'cookie-parser';
// import cors from 'cors';
// import express, { Express, Request, Response } from 'express';
// import helmet from 'helmet';
// import { pino } from 'pino';
// import swaggerUi from 'swagger-ui-express';
// import { DataSource, DataSourceOptions } from 'typeorm';
// import errorHandler from '@/common/middleware/errorHandler';
// import requestLogger from '@/common/middleware/requestLogger';
// import { UserCredibility } from './api/entity/Credibility';
// import { Address } from './api/entity/Address';
// import { BlockUser } from './api/entity/BlockUser';
// import { CarDetails } from './api/entity/CarDetails';
// import { CarEnquiry } from './api/entity/CarEnquiry';
// import { CarImages } from './api/entity/CarImages';
// import { CarReport } from './api/entity/CarReport';
// import { CarRequirement } from './api/entity/CarRequirement';
// import { Connections } from './api/entity/Connection';
// import { DropdownOptions } from './api/entity/DropdownOptions';
// import { IndianCity } from './api/entity/IndianCity';
// import { Location } from './api/entity/Location';
// import { Notifications } from './api/entity/Notifications';
// import { RepublishCarDetails } from './api/entity/RepublishCars';
// import { RequirementEnquiry } from './api/entity/RequirementEnquiry';
// import { SavedCar } from './api/entity/SavedCars';
// import { UserAuth } from './api/entity/UserAuth';
// import { UserKyc } from './api/entity/userkyc';
// import { UserLocation } from './api/entity/UserLocation';
// import { UserReport } from './api/entity/UserReport';
// import { UserReview } from './api/entity/UserReview';
// import appleOAuthRoutes from './api/routes/auth/AppleOAuthRoutes';
// import authRoutes from './api/routes/auth/AuthRoutes';
// import googleOAuthRoutes from './api/routes/auth/GoogleOAuthRoutes';
// import s3bucket from './api/routes/aws/s3';
// import ConnectionRoutes from './api/routes/connection/ConnectionRoutes';
// import DashboardRoute from './api/routes/dashboardRoutes/DashboardRoutes';
// import republishRoutes from './api/routes/dashboardRoutes/republishedRoute';
// import DropDownRouter from './api/routes/dropDown/dropdown';
// import kycProcessRoutes from './api/routes/kycProcess/kycProcessRoutes';
// import NotificationRoutes from './api/routes/notificationsRoutes/NotificationRoutes';
// import SocketNotificationRoute from './api/routes/notificationsRoutes/SocketNotificationRoute';
// import car from './api/routes/CarRoutes/CarRoute';
// import reviewRoutes from './api/routes/review/reviewRoute';
// import Profile from './api/routes/UpdateProfileRoute/updateProfileRoute';
// import UserLocationRoutes from './api/routes/User/UserLocationRoutes';
// import UserStatisticsRoutes from './api/routes/User/UserStatisticsRoutes';
// import tempRoutes from './api/temp/tempRoutes';
// import { swaggerSpec } from './config/swagger';
// import { initializeSocket } from './socket';

// const logger = pino({ name: 'server start' });
// const app: Express = express();

// // Create a DataSource instance
// const dataSourceOptions: DataSourceOptions = {
//   type: 'mysql',
//   host: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_HOST : process.env.LOCAL_DB_HOST,
//   port: 3306,
//   username: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_USERNAME : process.env.LOCAL_DB_USERNAME,
//   password: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_PASSWORD : process.env.LOCAL_DB_PASSWORD,
//   database: process.env.NODE_ENV === 'production' ? process.env.DEV_AWS_DB_NAME : process.env.LOCAL_DB_NAME,
//   entities: [
//     UserAuth,
//     CarDetails,
//     Address,
//     UserCredibility,
//     SavedCar,
//     CarRequirement,
//     DropdownOptions,
//     UserKyc,
//     RepublishCarDetails,
//     CarImages,
//     Location,
//     CarEnquiry,
//     Notifications,
//     UserReview,
//     RequirementEnquiry,
//     Connections,
//     BlockUser,
//     UserReport,
//     UserLocation,
//     IndianCity,
//     CarReport,
//   ],
//   synchronize: true,
//   logging: false,
//   entitySkipConstructor: false,
//   extra: {
//     connectionLimit: 10,
//     // Removed deprecated options: acquireTimeout, timeout
//     // These options are not supported in newer versions of MySQL2
//   },
// };

// const AppDataSource = new DataSource(dataSourceOptions);

// // Serve the public folder for Swagger UI assets
// // app.use(express.static('dist/public'));
// // Swagger UI setup
// app.use(
//   '/api-docs',
//   swaggerUi.serve,
//   swaggerUi.setup(swaggerSpec, {
//     explorer: true,
//     customCss: '.swagger-ui .topbar { display: none }',
//     customSiteTitle: 'NextDeal API Documentation',
//   })
// );

// // Initialize the DataSource before setting up routes
// // Database initialization is now handled by the initializeDatabase function below

// // Set the application to trust the reverse proxy
// app.set('trust proxy', true);

// // Middlewares
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// app.use(cookieParser());
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       callback(null, true);
//     },
//     credentials: true,
//   })
// );
// app.use(helmet());
// // app.use(rateLimiter); // Rate limiting disabled
// app.use(requestLogger);

// // Add timeout middleware to prevent hanging requests
// app.use((req: Request, res: Response, next) => {
//   // Set timeout for all requests
//   const timeout = setTimeout(() => {
//     if (!res.headersSent) {
//       logger.error(`Request timeout for ${req.method} ${req.url}`);
//       res.status(408).json({
//         status: 'error',
//         message: 'Request timeout',
//         path: req.url,
//         method: req.method,
//       });
//     }
//   }, 35000); // 30 seconds timeout

//   // Clear timeout when response is sent
//   res.on('finish', () => {
//     clearTimeout(timeout);
//   });

//   res.on('close', () => {
//     clearTimeout(timeout);
//   });

//   next();
// });

// // Routes mounting
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/auth/google', googleOAuthRoutes);
// app.use('/api/v1/auth/apple', appleOAuthRoutes);
// app.use('/api/v1/s3', s3bucket);
// app.use('/api/v1/car', car);
// app.use('/api/v1/profile', Profile);
// app.use('/api/v1/dropdown', DropDownRouter);
// app.use('/api/v1/kyc', kycProcessRoutes);
// app.use('/api/v1/dashboard', DashboardRoute);
// app.use('/api/v1/republish', republishRoutes);
// app.use('/api/v1/notification', NotificationRoutes);
// app.use('/api/v1/connection', ConnectionRoutes);
// app.use('/api/v1/notification', SocketNotificationRoute);
// app.use('/api/v1/review', reviewRoutes);
// app.use('/api/v1/user-location', UserLocationRoutes);
// app.use('/api/v1/user-statistics', UserStatisticsRoutes);
// app.use('/api/v1/temp', tempRoutes);

// app.get('/', (req, res) => {
//   res.send('Welcome to Dhikcar');
// });

// // api/v1/user-message this route is not work right now
// app.post('/api/v1/user-message', (req, res) => {
//   // Return a single consistent message for the live app
//   const message = "India's #1 Car Marketplace Deals Website";
//   res.json({ message });
// });

// // Health check endpoint for monitoring
// app.get('/health', (req: Request, res: Response) => {
//   const healthCheck = {
//     status: 'OK',
//     timestamp: new Date().toISOString(),
//     uptime: process.uptime(),
//     memory: process.memoryUsage(),
//     database: AppDataSource.isInitialized ? 'connected' : 'disconnected',
//   };

//   res.status(200).json(healthCheck);
// });

// // Deep health check endpoint
// app.get('/health/deep', async (req: Request, res: Response) => {
//   try {
//     // Check database connection
//     if (!AppDataSource.isInitialized) {
//       return res.status(503).json({
//         status: 'ERROR',
//         message: 'Database not connected',
//         timestamp: new Date().toISOString(),
//       });
//     }

//     // Test database query
//     await AppDataSource.query('SELECT 1 as test');

//     res.status(200).json({
//       status: 'OK',
//       message: 'All systems operational',
//       timestamp: new Date().toISOString(),
//       uptime: process.uptime(),
//       memory: process.memoryUsage(),
//       database: 'connected',
//     });
//   } catch (error: any) {
//     logger.error('Health check failed:', error);
//     res.status(503).json({
//       status: 'ERROR',
//       message: 'Health check failed',
//       error: error instanceof Error ? error.message : 'Unknown error',
//       timestamp: new Date().toISOString(),
//     });
//   }
// });

// // Error handlers
// app.use(errorHandler());

// // Initialize HTTP server and WebSocket
// const httpServer = initializeSocket(app);

// // Set server timeouts
// httpServer.timeout = 30000;
// httpServer.keepAliveTimeout = 65000;
// httpServer.headersTimeout = 66000;

// // Enhanced database connection with retry logic
// let dbRetryCount = 0;
// const MAX_DB_RETRIES = 5;
// const DB_RETRY_DELAY = 5000;

// // const initializeDatabase = async (): Promise<void> => {
// //   try {
// //     if (!AppDataSource.isInitialized) {
// //       await AppDataSource.initialize();
// //       logger.info('Database connection established successfully');
// //       dbRetryCount = 0; // Reset retry count on success
// //       try {
// //         // const modelLoader = ModelLoader.getInstance();
// //         // await modelLoader.loadModels();
// //         logger.info('ML models loaded successfully');
// //       } catch (error: any) {
// //         logger.error('Error loading ML models:', error);
// //         // Continue server startup even if models fail to load
// //       }
// //     }
// //   } catch (error: any) {
// //     logger.error('Database connection failed:', error);
// //     if (error && typeof error === 'object' && 'code' in error) {
// //       if (error.code === 'ETIMEDOUT') {
// //         logger.error(
// //           'Database connection timed out. Check network connectivity to RDS instance and security group settings.'
// //         );
// //       } else if (error.code === 'ECONNREFUSED') {
// //         logger.error(
// //           'Database connection refused. Make sure the database server is running and accepting connections.'
// //         );
// //       }
// //     }
// //     dbRetryCount++;

// //     if (dbRetryCount < MAX_DB_RETRIES) {
// //       logger.info(`Retrying database connection in ${DB_RETRY_DELAY}ms (attempt ${dbRetryCount}/${MAX_DB_RETRIES})`);
// //       setTimeout(initializeDatabase, DB_RETRY_DELAY);
// //     } else {
// //       logger.error('Maximum database retry attempts reached');
// //       process.exit(1);
// //     }
// //   }
// // };

// // Initialize database connection

// const initializeDatabase = async (): Promise<void> => {
//   try {
//     if (!AppDataSource.isInitialized) {
//       await AppDataSource.initialize();
//       logger.info('Database connected!');
//       dbRetryCount = 0; // reset retry count
//     }
//   } catch (error: any) {
//     logger.error('Database connection failed:', error);
//     dbRetryCount++;
//     if (dbRetryCount < MAX_DB_RETRIES) {
//       logger.info(`Retrying database connection (${dbRetryCount}/${MAX_DB_RETRIES}) in ${DB_RETRY_DELAY}ms`);
//       setTimeout(initializeDatabase, DB_RETRY_DELAY);
//     } else {
//       logger.error('Max retries reached, exiting.');
//       process.exit(1);
//     }
//   }
// };

// initializeDatabase();

// // Database connection monitoring
// setInterval(async () => {
//   try {
//     if (AppDataSource.isInitialized) {
//       await AppDataSource.query('SELECT 1 as heartbeat');
//     } else {
//       logger.warn('Database connection lost, attempting to reconnect...');
//       await initializeDatabase();
//     }
//   } catch (error: any) {
//     logger.error('Database heartbeat failed:', error);
//     // Attempt to reinitialize connection
//     try {
//       await AppDataSource.destroy();
//       await initializeDatabase();
//     } catch (reconnectError: any) {
//       logger.error('Failed to reconnect to database:', reconnectError);
//     }
//   }
// }, 30000); // Check every 30 seconds

// initializeDatabase();

// // Enhanced graceful shutdown handlers
// const gracefulShutdown = async () => {
//   logger.info('Received shutdown signal');

//   // Close HTTP server
//   if (httpServer) {
//     httpServer.close(() => {
//       logger.info('HTTP server closed');
//     });
//   }

//   // Close database connection
//   if (AppDataSource.isInitialized) {
//     try {
//       await AppDataSource.destroy();
//       logger.info('Database connection closed');
//     } catch (error: any) {
//       logger.error('Error closing database connection:', error);
//     }
//   }

//   // Exit process
//   process.exit(0);
// };

// // Handle termination signals
// process.on('SIGTERM', gracefulShutdown);
// process.on('SIGINT', gracefulShutdown);

// // Enhanced uncaught exception handling
// process.on('uncaughtException', (error: any) => {
//   logger.error('Uncaught Exception:', error);
//   logger.error('Stack trace:', error.stack);

//   // Log additional system information
//   // logger.error('Process memory usage:', process.memoryUsage());
//   // logger.error('Process uptime:', process.uptime());

//   // Exit with error code to trigger restart
//   process.exit(1);
// });

// // Enhanced unhandled promise rejection handling
// // process.on('unhandledRejection', (reason, promise) => {
// //   logger.error('Unhandled Rejection at:', promise, 'reason:', reason);

// //   // Log additional system information
// //   logger.error('Process memory usage:', process.memoryUsage());
// //   logger.error('Process uptime:', process.uptime());

// //   // Exit with error code to trigger restart
// //   process.exit(1);
// // });

// export { app, AppDataSource, httpServer, logger };
