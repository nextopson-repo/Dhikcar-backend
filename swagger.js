/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'fs';
import path from 'path';
import swaggerAutogen from 'swagger-autogen';

const swagger = swaggerAutogen();
const outputFile = './src/swagger_output.json';
const endpointsFiles = ['./src/server.ts']; // Adjust the path as necessary

// Ensure the directory exists
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

swagger(outputFile, endpointsFiles);
