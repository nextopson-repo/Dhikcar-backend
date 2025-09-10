module.exports = {
  apps: [
    {
      name: "nextdealAppServer",
      // Option 1: Run TypeScript directly with tsx (recommended for development)
      script: "npx",
      args: "tsx src/index.ts",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
        PORT: 5000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000
      },
      // Enhanced restart configuration
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      
      // Logging configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,
      
      // Environment variables
      env_file: '.env',
      
      // Node.js optimization
      node_args: '--max-old-space-size=1024',
      merge_logs: true,
      
      // Graceful shutdown
      shutdown_with_message: true
    },
    // Alternative configuration for compiled JavaScript (uncomment to use)
    // {
    //   name: "nextdealAppServer-compiled",
    //   script: "dist/index.cjs",
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: "500M",
    //   env: {
    //     NODE_ENV: "development",
    //     PORT: 5000
    //   },
    //   env_production: {
    //     NODE_ENV: "production",
    //     PORT: 5000
    //   },
    //   max_restarts: 10,
    //   min_uptime: '10s',
    //   restart_delay: 4000,
    //   log_file: './logs/combined.log',
    //   out_file: './logs/out.log',
    //   error_file: './logs/error.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   kill_timeout: 5000,
    //   wait_ready: true,
    //   listen_timeout: 8000,
    //   env_file: '.env',
    //   node_args: '--max-old-space-size=1024',
    //   merge_logs: true,
    //   shutdown_with_message: true
    // },
    // Alternative configuration for ts-node (uncomment to use)
    // {
    //   name: "nextdealAppServer-tsnode",
    //   script: "npx",
    //   args: "ts-node src/index.ts",
    //   instances: 1,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: "500M",
    //   env: {
    //     NODE_ENV: "development",
    //     PORT: 5000
    //   },
    //   env_production: {
    //     NODE_ENV: "production",
    //     PORT: 5000
    //   },
    //   max_restarts: 10,
    //   min_uptime: '10s',
    //   restart_delay: 4000,
    //   log_file: './logs/combined.log',
    //   out_file: './logs/out.log',
    //   error_file: './logs/error.log',
    //   log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    //   kill_timeout: 5000,
    //   wait_ready: true,
    //   listen_timeout: 8000,
    //   env_file: '.env',
    //   node_args: '--max-old-space-size=1024',
    //   merge_logs: true,
    //   shutdown_with_message: true
    // }
  ],
}; 