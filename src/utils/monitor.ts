import axios from 'axios';

import { logger } from '@/server';

interface HealthCheckResult {
  status: string;
  timestamp: string;
  uptime: number;
  memory: any;
  database: string;
}

interface MonitorConfig {
  healthCheckUrl: string;
  checkInterval: number;
  maxFailures: number;
  restartCommand: string;
}

export class ServerMonitor {
  private failureCount = 0;
  private isMonitoring = false;
  private config: MonitorConfig;

  constructor(config: MonitorConfig) {
    this.config = config;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting server monitoring...');

    setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.checkInterval);
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    logger.info('Stopping server monitoring...');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const response = await axios.get<HealthCheckResult>(this.config.healthCheckUrl, {
        timeout: 10000,
      });

      if (response.data.status === 'OK') {
        this.failureCount = 0;
        logger.debug('Health check passed');
      } else {
        this.failureCount++;
        logger.warn(`Health check failed: ${response.data.status}`);
      }
    } catch (error) {
      this.failureCount++;
      logger.error(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check if we need to restart
    if (this.failureCount >= this.config.maxFailures) {
      logger.error(`Server has failed ${this.failureCount} times, attempting restart...`);
      await this.restartServer();
    }
  }

  private async restartServer(): Promise<void> {
    try {
      logger.info('Executing restart command...');
      // In a real implementation, you might want to use child_process.exec
      // For now, we'll just log the restart attempt
      logger.info(`Restart command: ${this.config.restartCommand}`);

      // Reset failure count after restart attempt
      this.failureCount = 0;
    } catch (error) {
      logger.error('Failed to restart server:', error);
    }
  }

  getStatus(): { isMonitoring: boolean; failureCount: number; maxFailures: number } {
    return {
      isMonitoring: this.isMonitoring,
      failureCount: this.failureCount,
      maxFailures: this.config.maxFailures,
    };
  }
}

// Default monitor instance
export const defaultMonitor = new ServerMonitor({
  healthCheckUrl: 'http://localhost:5000/health',
  checkInterval: 30000, // 30 seconds
  maxFailures: 3,
  restartCommand: 'pm2 restart nextdeal-backend',
});

// Export for use in other parts of the application
export default defaultMonitor;
