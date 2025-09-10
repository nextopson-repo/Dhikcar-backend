import { sendEmailNotification } from './mailService';

interface DelayedEmailJob {
  id: string;
  email: string;
  subject: string;
  body: string;
  scheduledTime: Date;
  timeoutId?: NodeJS.Timeout;
  type: 'single' | 'bundled';
}

interface BundledEmailItem {
  type: 'republish_create' | 'republish_update' | 'republish_approve' | 'republish_reject';
  propertyId: string;
  propertyName: string;
  propertyPrice?: number;
  propertyLocation?: string;
  propertyImage?: string;
  republisherName?: string;
  ownerName?: string;
  timestamp: Date;
  republishId?: string;
}

interface BundledEmailJob {
  email: string;
  items: BundledEmailItem[];
  scheduledTime: Date;
  timeoutId?: NodeJS.Timeout;
}

class DelayedEmailService {
  private jobs: Map<string, DelayedEmailJob> = new Map();
  private bundledJobs: Map<string, BundledEmailJob> = new Map();
  private isInitialized = false;

  constructor() {
    // Initialize the service
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;

    // Set up process exit handler to clear timeouts
    process.on('SIGINT', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('exit', () => this.cleanup());

    this.isInitialized = true;
    console.log('DelayedEmailService initialized');
  }

  private cleanup() {
    console.log('Cleaning up delayed email jobs...');
    this.jobs.forEach((job) => {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
    });
    this.jobs.clear();

    this.bundledJobs.forEach((job) => {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
    });
    this.bundledJobs.clear();
  }

  private generateJobId(): string {
    return `delayed_email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBundledJobId(email: string): string {
    return `bundled_email_${email}_${Date.now()}`;
  }

  /**
   * Add item to bundled email for republish notifications
   * @param email - Recipient email address
   * @param item - Email item to bundle
   * @param delayMinutes - Delay in minutes (default: 30 minutes)
   * @returns Job ID for tracking
   */
  public addToBundledEmail(email: string, item: BundledEmailItem, delayMinutes: number = 30): string {
    const jobId = this.generateBundledJobId(email);
    const existingJob = this.bundledJobs.get(jobId);

    if (existingJob) {
      // Add to existing bundled job
      existingJob.items.push(item);
      return jobId;
    }

    // Create new bundled job
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    const bundledJob: BundledEmailJob = {
      email,
      items: [item],
      scheduledTime,
    };

    // Schedule the bundled email
    const timeoutId = setTimeout(
      async () => {
        try {
          console.log(`Sending bundled email to ${email} (Job ID: ${jobId})`);
          const emailBody = this.generateBundledEmailBody(bundledJob.items);
          const emailSubject = this.generateBundledEmailSubject(bundledJob.items);

          await sendEmailNotification(email, emailSubject, emailBody);
          console.log(`Bundled email sent successfully to ${email} (Job ID: ${jobId})`);
        } catch (error) {
          console.error(`Failed to send bundled email to ${email} (Job ID: ${jobId}):`, error);
        } finally {
          // Remove job from tracking
          this.bundledJobs.delete(jobId);
        }
      },
      delayMinutes * 60 * 1000
    );

    bundledJob.timeoutId = timeoutId;
    this.bundledJobs.set(jobId, bundledJob);

    console.log(`Scheduled bundled email for ${email} in ${delayMinutes} minutes (Job ID: ${jobId})`);
    return jobId;
  }

  /**
   * Generate bundled email subject based on items
   */
  private generateBundledEmailSubject(items: BundledEmailItem[]): string {
    const itemCount = items.length;

    if (itemCount === 1) {
      const item = items[0];
      switch (item.type) {
        case 'republish_create':
          return `New Republish Request - ${item.propertyName}`;
        case 'republish_update':
          return `Republish Request Updated - ${item.propertyName}`;
        case 'republish_approve':
          return `Republish Request Approved - ${item.propertyName}`;
        case 'republish_reject':
          return `Republish Request Rejected - ${item.propertyName}`;
        default:
          return `Property Update - ${item.propertyName}`;
      }
    }

    return `You have ${itemCount} property updates on NextDeal`;
  }

  /**
   * Generate bundled email body with proper UI and deep links
   */
  private generateBundledEmailBody(items: BundledEmailItem[]): string {
    const itemCount = items.length;
    const isMultiple = itemCount > 1;

    let itemsHtml = '';

    items.forEach((item, index) => {
      const itemHtml = this.generateEmailItemHtml(item, index + 1);
      itemsHtml += itemHtml;
    });

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NextDeal Property Updates</title>
        <style>
            body {
                font-family: 'Urbanist', Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f5f5f5;
                color: #001A48;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #0055F1 0%, #001A48 100%);
                padding: 30px 20px;
                text-align: center;
            }
            .header h1 {
                color: #ffffff;
                margin: 0;
                font-size: 28px;
                font-weight: 700;
            }
            .header p {
                color: #CCDDFC;
                margin: 10px 0 0 0;
                font-size: 16px;
                font-weight: 400;
            }
            .content {
                padding: 30px 20px;
            }
            .summary {
                background-color: #EAF2FE;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 25px;
                border-left: 4px solid #0055F1;
            }
            .summary h2 {
                color: #001A48;
                margin: 0 0 10px 0;
                font-size: 20px;
                font-weight: 600;
            }
            .summary p {
                color: #003391;
                margin: 0;
                font-size: 16px;
                font-weight: 400;
            }
            .item {
                background-color: #ffffff;
                border: 1px solid #B3CCFB;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                position: relative;
            }
            .item-number {
                position: absolute;
                top: -10px;
                left: 20px;
                background-color: #0055F1;
                color: #ffffff;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 600;
            }
            .item-header {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
            }
            .item-image {
                width: 60px;
                height: 60px;
                border-radius: 8px;
                object-fit: cover;
                margin-right: 15px;
                background-color: #f0f0f0;
            }
            .item-details h3 {
                color: #001A48;
                margin: 0 0 5px 0;
                font-size: 18px;
                font-weight: 600;
            }
            .item-details p {
                color: #003391;
                margin: 0;
                font-size: 14px;
                font-weight: 400;
            }
            .item-status {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                margin-top: 8px;
            }
            .status-create { background-color: #EAF2FE; color: #0055F1; }
            .status-update { background-color: #FFF3CD; color: #856404; }
            .status-approve { background-color: #D4EDDA; color: #155724; }
            .status-reject { background-color: #F8D7DA; color: #721C24; }
            .item-info {
                display: flex;
                justify-content: space-between;
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid #EAF2FE;
            }
            .price {
                color: #001A48;
                font-size: 18px;
                font-weight: 700;
            }
            .location {
                color: #003391;
                font-size: 14px;
                font-weight: 400;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #0055F1 0%, #001A48 100%);
                color: #ffffff;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 16px;
                margin-top: 20px;
                transition: all 0.3s ease;
            }
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 85, 241, 0.3);
            }
            .footer {
                background-color: #001A48;
                padding: 20px;
                text-align: center;
            }
            .footer p {
                color: #CCDDFC;
                margin: 0;
                font-size: 14px;
                font-weight: 400;
            }
            .footer a {
                color: #B3CCFB;
                text-decoration: none;
            }
            .timestamp {
                color: #666666;
                font-size: 12px;
                margin-top: 10px;
                font-weight: 400;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>NextDeal</h1>
                <p>Your Property Updates</p>
            </div>
            
            <div class="content">
                <div class="summary">
                    <h2>${isMultiple ? `You have ${itemCount} property updates` : 'Property Update'}</h2>
                    <p>${isMultiple ? 'Here are the latest updates on your properties:' : 'Here is the latest update on your property:'}</p>
                </div>
                
                ${itemsHtml}
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="https://nextdeal.in/dashboard/properties" class="cta-button">
                        View All Properties
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p>© 2024 NextDeal. All rights reserved.</p>
                <p>Download our app: <a href="https://nextdeal.in/app">nextdeal.in/app</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate HTML for individual email item
   */
  private generateEmailItemHtml(item: BundledEmailItem, index: number): string {
    const statusClass = `status-${item.type.split('_')[1]}`;
    const statusText = this.getStatusText(item.type);
    const actionText = this.getActionText(item.type, item.republisherName, item.ownerName);
    const deepLink = `https://nextdeal.in/property/${item.propertyId}${item.republishId ? `?republishId=${item.republishId}` : ''}`;

    const formatPrice = (price?: number) => {
      if (!price) return 'Price not available';
      if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)} Cr`;
      if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
      if (price >= 1000) return `₹${(price / 1000).toFixed(1)} K`;
      return `₹${price}`;
    };

    return `
    <div class="item">
        <div class="item-number">${index}</div>
        <div class="item-header">
            <img src="${item.propertyImage || 'https://nextdeal.in/placeholder-property.jpg'}" alt="${item.propertyName}" class="item-image" onerror="this.style.display='none'">
            <div class="item-details">
                <h3>${item.propertyName}</h3>
                <p>${actionText}</p>
                <span class="item-status ${statusClass}">${statusText}</span>
            </div>
        </div>
        <div class="item-info">
            <div>
                <div class="price">${formatPrice(item.propertyPrice)}</div>
                <div class="location">${item.propertyLocation || 'Location not available'}</div>
            </div>
            <div style="text-align: right;">
                <a href="${deepLink}" class="cta-button" style="margin-top: 0; padding: 8px 16px; font-size: 14px;">
                    View Property
                </a>
            </div>
        </div>
        <div class="timestamp">
            ${item.timestamp.toLocaleString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
        </div>
    </div>
    `;
  }

  /**
   * Get status text for email item
   */
  private getStatusText(type: string): string {
    switch (type) {
      case 'republish_create':
        return 'New Request';
      case 'republish_update':
        return 'Updated';
      case 'republish_approve':
        return 'Approved';
      case 'republish_reject':
        return 'Rejected';
      default:
        return 'Update';
    }
  }

  /**
   * Get action text for email item
   */
  private getActionText(type: string, republisherName?: string, ownerName?: string): string {
    switch (type) {
      case 'republish_create':
        return republisherName
          ? `${republisherName} requested to republish this property`
          : 'New republish request received';
      case 'republish_update':
        return 'Republish request has been updated';
      case 'republish_approve':
        return ownerName ? `${ownerName} approved your republish request` : 'Republish request approved';
      case 'republish_reject':
        return ownerName ? `${ownerName} rejected your republish request` : 'Republish request rejected';
      default:
        return 'Property update';
    }
  }

  /**
   * Schedule an email to be sent after a specified delay
   * @param email - Recipient email address
   * @param subject - Email subject
   * @param body - Email body (HTML)
   * @param delayHours - Delay in hours (default: 2 hours)
   * @returns Job ID for tracking
   */
  public scheduleEmail(email: string, subject: string, body: string, delayHours: number = 2): string {
    const jobId = this.generateJobId();
    const scheduledTime = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    const job: DelayedEmailJob = {
      id: jobId,
      email,
      subject,
      body,
      scheduledTime,
      type: 'single',
    };

    // Schedule the email
    const timeoutId = setTimeout(
      async () => {
        try {
          console.log(`Sending delayed email to ${email} (Job ID: ${jobId})`);
          await sendEmailNotification(email, subject, body);
          console.log(`Delayed email sent successfully to ${email} (Job ID: ${jobId})`);
        } catch (error) {
          console.error(`Failed to send delayed email to ${email} (Job ID: ${jobId}):`, error);
        } finally {
          // Remove job from tracking
          this.jobs.delete(jobId);
        }
      },
      delayHours * 60 * 60 * 1000
    );

    job.timeoutId = timeoutId;
    this.jobs.set(jobId, job);

    console.log(`Scheduled email for ${email} in ${delayHours} hours (Job ID: ${jobId})`);
    return jobId;
  }

  /**
   * Cancel a scheduled email
   * @param jobId - The job ID to cancel
   * @returns true if job was cancelled, false if not found
   */
  public cancelEmail(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }

    this.jobs.delete(jobId);
    console.log(`Cancelled delayed email job: ${jobId}`);
    return true;
  }

  /**
   * Get all pending jobs
   * @returns Array of pending job information
   */
  public getPendingJobs(): Array<{ id: string; email: string; scheduledTime: Date; type: string }> {
    const singleJobs = Array.from(this.jobs.values()).map((job) => ({
      id: job.id,
      email: job.email,
      scheduledTime: job.scheduledTime,
      type: job.type,
    }));

    const bundledJobs = Array.from(this.bundledJobs.values()).map((job) => ({
      id: `bundled_${job.email}`,
      email: job.email,
      scheduledTime: job.scheduledTime,
      type: 'bundled',
    }));

    return [...singleJobs, ...bundledJobs];
  }

  /**
   * Get job count
   * @returns Number of pending jobs
   */
  public getJobCount(): number {
    return this.jobs.size + this.bundledJobs.size;
  }
}

// Export singleton instance
export const delayedEmailService = new DelayedEmailService();

// Export the class for testing purposes
export { DelayedEmailService };
