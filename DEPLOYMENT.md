# NextDeal Backend Deployment Guide

## EC2 Deployment with PM2

This guide explains how to deploy the NextDeal backend on EC2 with PM2 for automatic restart and monitoring.

### Prerequisites

- EC2 instance running Ubuntu/Debian
- Node.js 18+ installed
- PM2 installed globally
- MySQL database (RDS or local)

### Installation Steps

1. **Install Node.js and PM2**
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

2. **Clone and Setup Project**
```bash
# Clone your repository
git clone <your-repo-url>
cd nextdealAppServer

# Install dependencies
npm install

# Build the project
npm run build
```

3. **Environment Configuration**
```bash
# Copy and configure environment variables
cp .env.example .env
# Edit .env with your production settings
nano .env
```

4. **Create Logs Directory**
```bash
mkdir -p logs
```

### PM2 Deployment

1. **Start with PM2**
```bash
# Start the application with PM2
npm run pm2:start

# Or directly with PM2
pm2 start ecosystem.config.js --env production
```

2. **PM2 Management Commands**
```bash
# Check status
npm run pm2:status
# or
pm2 status

# View logs
npm run pm2:logs
# or
pm2 logs

# Monitor processes
npm run pm2:monit
# or
pm2 monit

# Restart application
npm run pm2:restart
# or
pm2 restart nextdeal-backend

# Reload application (zero-downtime)
npm run pm2:reload
# or
pm2 reload nextdeal-backend

# Stop application
npm run pm2:stop
# or
pm2 stop nextdeal-backend

# Delete application
npm run pm2:delete
# or
pm2 delete nextdeal-backend
```

3. **Setup PM2 Startup Script**
```bash
# Generate startup script
pm2 startup

# Save current PM2 configuration
pm2 save
```

### Health Monitoring

The server includes built-in health check endpoints:

- **Basic Health Check**: `GET /health`
- **Deep Health Check**: `GET /health/deep`

### Automatic Restart Features

The server includes several automatic restart mechanisms:

1. **Process-Level Restart**
   - Uncaught exceptions trigger restart
   - Unhandled promise rejections trigger restart
   - Memory usage monitoring (restart if > 1GB heap used)

2. **Database Connection Recovery**
   - Automatic database reconnection
   - Connection heartbeat monitoring
   - Retry logic with exponential backoff

3. **PM2-Level Restart**
   - Process crashes trigger PM2 restart
   - Memory limit exceeded triggers restart
   - Configurable restart delays and limits

### Monitoring and Logging

1. **PM2 Logs**
```bash
# View all logs
pm2 logs

# View specific app logs
pm2 logs nextdeal-backend

# View error logs only
pm2 logs nextdeal-backend --err
```

2. **Application Logs**
- Logs are stored in `./logs/` directory
- Combined logs: `./logs/combined.log`
- Output logs: `./logs/out.log`
- Error logs: `./logs/error.log`

### Production Configuration

The `ecosystem.config.js` file includes:

- **Clustering**: Uses all available CPU cores
- **Memory Management**: Restart if memory exceeds 1GB
- **Logging**: Structured logging with timestamps
- **Health Checks**: Built-in health monitoring
- **Graceful Shutdown**: Proper cleanup on restart

### Troubleshooting

1. **Server Won't Start**
```bash
# Check logs
pm2 logs nextdeal-backend

# Check if port is in use
sudo netstat -tulpn | grep :5000

# Kill process using port
sudo kill -9 <PID>
```

2. **Database Connection Issues**
```bash
# Check database connectivity
curl http://localhost:5000/health/deep

# Check environment variables
pm2 env nextdeal-backend
```

3. **High Memory Usage**
```bash
# Monitor memory usage
pm2 monit

# Check memory usage via API
curl http://localhost:5000/health
```

### Security Considerations

1. **Firewall Configuration**
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

2. **Environment Variables**
- Never commit `.env` files
- Use secure environment variable management
- Rotate database credentials regularly

### Backup and Recovery

1. **Database Backups**
```bash
# Create database backup
mysqldump -u username -p database_name > backup.sql

# Restore database
mysql -u username -p database_name < backup.sql
```

2. **Application Backups**
```bash
# Backup application files
tar -czf nextdeal-backup-$(date +%Y%m%d).tar.gz ./

# Backup PM2 configuration
pm2 save
```

### Performance Optimization

1. **Node.js Optimization**
- Uses `--max-old-space-size=2048` for increased heap size
- Clustering for better CPU utilization
- Connection pooling for database

2. **Monitoring**
- Regular health checks
- Memory usage monitoring
- Database connection monitoring

### Update Deployment

1. **Code Updates**
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Reload PM2 (zero-downtime)
pm2 reload nextdeal-backend
```

2. **Environment Updates**
```bash
# Update environment variables
nano .env

# Restart application
pm2 restart nextdeal-backend
```

This setup ensures your server will automatically restart on crashes, handle database disconnections, and provide comprehensive monitoring for production deployment on EC2. 