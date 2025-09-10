#!/usr/bin/env node

/**
 * Script to clean up duplicate user entries in the database
 * Run this script once to fix existing duplicate entries
 * 
 * Usage: node scripts/cleanup-duplicates.js
 */

import { cleanupDuplicateUsers } from '../src/utils/cleanupDuplicates.js';
import { AppDataSource } from '../src/server.js';

console.log('Starting duplicate user cleanup...');

AppDataSource.initialize()
  .then(async () => {
    console.log('Database connected successfully.');
    await cleanupDuplicateUsers();
    console.log('Cleanup completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }); 