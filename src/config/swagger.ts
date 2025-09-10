import swaggerJsdoc from 'swagger-jsdoc';
import { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NextDeal API Documentation',
      version: '1.0.0',
      description: 'API documentation for NextDeal Backend',
      contact: {
        name: 'API Support',
        email: 'support@nextdeal.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/api/docs/*.swagger.ts', // Documentation files
    './src/api/routes/**/*.ts', // Route files
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
