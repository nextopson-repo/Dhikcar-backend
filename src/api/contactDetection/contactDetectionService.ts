import { DetectDocumentTextCommand, TextractClient } from '@aws-sdk/client-textract';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

import awsRekognitionService from '@/api/recognition/awsRekognitionService';

interface ContactDetectionResult {
  hasContactInfo: boolean;
  detectedItems: {
    phoneNumbers: string[];
    emailAddresses: string[];
    socialMediaHandles: string[];
  };
  confidence: string;
}

class ContactDetectionService {
  private worker: any = null;
  private textractClient: TextractClient | null = null;
  private readonly phonePatterns = [
    /\b(\+91|91)?[6-9]\d{9}\b/g, // +91 8319697083 or 8319697083
    /\b[6-9]\d{9}\b/g, // 8319697083
    /\b(\+91|91)?[6-9]\d{2}\s?\d{3}\s?\d{4}\b/g, // +91 831 969 7083
    /\b[6-9]\d{2}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // 831-969-7083 or 831.969.7083
    /\b\d{8,}\b/g, // 8+ digits in a row
    /\b(one|two|three|four|five|six|seven|eight|nine|zero)(\s+|[-.]){7,}(one|two|three|four|five|six|seven|eight|nine|zero)\b/gi,
    // Additional patterns for better detection
    /\b\d{10}\b/g, // Exactly 10 digits
    /\b\d{11}\b/g, // Exactly 11 digits (with country code)
    /\b\d{12}\b/g, // Exactly 12 digits (with country code)
    /\b\d{13}\b/g, // Exactly 13 digits (with country code)
    /\b\d{14}\b/g, // Exactly 14 digits (with country code)
    /\b\d{15}\b/g, // Exactly 15 digits (with country code)
    /\b\d{16}\b/g, // Exactly 16 digits (with country code)
    /\b\d{17}\b/g, // Exactly 17 digits (with country code)
    /\b\d{18}\b/g, // Exactly 18 digits (with country code)
    /\b\d{19}\b/g, // Exactly 19 digits (with country code)
    /\b\d{20}\b/g, // Exactly 20 digits (with country code)
  ];
  private readonly emailPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\s*\.\s*[A-Z|a-z]{2,}\b/g,
  ];
  private readonly socialMediaPatterns = [
    /\b(?:@|at)\s*[A-Za-z0-9._]{3,}\b/g,
    /\b(?:instagram|facebook|twitter|linkedin|youtube|tiktok)\s*[:.]?\s*[A-Za-z0-9._]{3,}\b/gi,
    /\b[A-Za-z0-9._]{3,}\s*on\s*(?:instagram|facebook|twitter|linkedin|youtube|tiktok)\b/gi,
  ];
  private readonly contactKeywords = [
    'contact',
    'phone',
    'mobile',
    'call',
    'email',
    'whatsapp',
    'telegram',
    'reach',
    'connect',
    'message',
    'text',
    'dial',
    'number',
    'address',
    'संपर्क',
    'फोन',
    'मोबाइल',
    'कॉल',
    'ईमेल',
    'व्हाट्सऐप',
    'टेलीग्राम',
    'पहुंच',
    'जुड़ें',
    'संदेश',
    'टेक्स्ट',
    'डायल',
    'नंबर',
    'पता',
  ];

  constructor() {
    this.initializeWorker();
    this.initializeTextract();
  }

  private async initializeWorker(): Promise<void> {
    try {
      this.worker = await createWorker('eng', 1, {
        logger: () => {}, // Disable Tesseract logging in production
      });
    } catch (error) {
      console.error('Failed to initialize contact detection worker:', error);
    }
  }

  private initializeTextract(): void {
    if (process.env.CONTACT_DETECTION_USE_AWS === 'true') {
      this.textractClient = new TextractClient({
        region: process.env.AWS_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    return await sharp(imageBuffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .sharpen() // Enhance edges
      .normalize() // Normalize contrast
      .toFormat('jpeg', { quality: 90 })
      .toBuffer();
  }

  private detectPhoneNumbers(text: string): string[] {
    const phoneNumbers: string[] = [];

    // Use all the phone patterns defined in the class
    for (const pattern of this.phonePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        phoneNumbers.push(...matches);
      }
    }

    // Additional aggressive pattern for any sequence of 8+ digits
    const aggressivePattern = /\d{8,}/g;
    const aggressiveMatches = text.match(aggressivePattern) || [];
    phoneNumbers.push(...aggressiveMatches);

    // Remove duplicates and clean up
    const allMatches = [...new Set(phoneNumbers)]
      .map((num) => num.trim())
      .filter((num) => num.length >= 8)
      .filter((num) => /^\d+$/.test(num.replace(/[^0-9]/g, ''))); // Only keep numbers with digits

    return allMatches;
  }

  private detectEmailAddresses(text: string): string[] {
    const emailAddresses: string[] = [];
    for (const pattern of this.emailPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        emailAddresses.push(...matches);
      }
    }
    return [...new Set(emailAddresses)].map((email) => email.trim());
  }

  private detectSocialMediaHandles(text: string): string[] {
    const socialMediaHandles: string[] = [];
    for (const pattern of this.socialMediaPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        socialMediaHandles.push(...matches);
      }
    }
    return [...new Set(socialMediaHandles)].map((handle) => handle.trim());
  }

  private hasContactKeywords(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.contactKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
  }

  isEnabled(): boolean {
    return process.env.CONTACT_DETECTION_ENABLED === 'true';
  }

  getServiceInfo(): {
    enabled: boolean;
    patterns: {
      phonePatterns: number;
      emailPatterns: number;
      socialMediaPatterns: number;
      contactKeywords: number;
    };
  } {
    return {
      enabled: this.isEnabled(),
      patterns: {
        phonePatterns: this.phonePatterns.length,
        emailPatterns: this.emailPatterns.length,
        socialMediaPatterns: this.socialMediaPatterns.length,
        contactKeywords: this.contactKeywords.length,
      },
    };
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Public method to detect contact info in an image buffer (OCR + pattern matching)
   */
  public async detectContactInfo(imageBuffer: Buffer): Promise<ContactDetectionResult> {
    let text = '';
    let usedTextract = false;
    try {
      // Preprocess image for better OCR
      const processedBuffer = await this.preprocessImage(imageBuffer);
      // Use AWS Textract if enabled and configured
      if (process.env.CONTACT_DETECTION_USE_AWS === 'true' && this.textractClient) {
        const command = new DetectDocumentTextCommand({
          Document: { Bytes: processedBuffer },
        });
        const response = await this.textractClient.send(command);
        text = (response.Blocks || [])
          .filter((block) => block.BlockType === 'LINE' && block.Text)
          .map((block) => block.Text)
          .join(' ');
        usedTextract = true;
      } else if (this.worker) {
        // Use Tesseract.js as fallback
        const { data } = await this.worker.recognize(processedBuffer);
        text = data.text || '';
      } else {
        throw new Error('No OCR engine available');
      }
    } catch (err) {
      console.error('OCR failed:', err);
      text = '';
    }
    // Run detection logic
    const phoneNumbers = this.detectPhoneNumbers(text);
    const emailAddresses = this.detectEmailAddresses(text);
    const socialMediaHandles = this.detectSocialMediaHandles(text);
    const hasContactInfo =
      phoneNumbers.length > 0 ||
      emailAddresses.length > 0 ||
      socialMediaHandles.length > 0 ||
      this.hasContactKeywords(text);
    return {
      hasContactInfo,
      detectedItems: {
        phoneNumbers,
        emailAddresses,
        socialMediaHandles,
      },
      confidence: usedTextract ? 'AWS Textract' : 'Tesseract.js',
    };
  }
}

/**
 * Detect if the image is a card (business card, id card, etc.) or not a real estate image using AWS Rekognition.
 * Reject if so, otherwise return null (no rejection).
 */
export async function detectAndRejectCardsOrNonRealEstate(
  imageBuffer: Buffer
): Promise<{ rejected: boolean; reason?: string; labels?: string[] }> {
  // Only run if AWS Rekognition is enabled and configured
  if (!awsRekognitionService.isEnabled() || !awsRekognitionService.isConfigured()) {
    return { rejected: false };
  }
  try {
    const rekognitionResult = await awsRekognitionService.analyzeImage(imageBuffer);
    const labels = (rekognitionResult.labels || []).map((l) => l.name.toLowerCase());
    // Card-related keywords
    const cardKeywords = [
      'card',
      'business card',
      'id card',
      'identity card',
      'aadhar',
      'pan card',
      'driving license',
      'license',
      'visiting card',
      'atm card',
      'credit card',
      'debit card',
      'bank card',
      'voter id',
      'passport',
      'badge',
      'document',
      'certificate',
    ];
    // Real estate room types (from awsRekognitionService roomTypeMapping)
    const realEstateRoomTypes = ['bathroom', 'bedroom', 'dining', 'kitchen', 'livingroom', 'balcony', 'other'];
    // If any label matches a card keyword, reject
    if (labels.some((label) => cardKeywords.some((keyword) => label.includes(keyword)))) {
      return { rejected: true, reason: 'Image appears to be a card (business card, ID, etc.)', labels };
    }
    // If none of the labels match real estate room types, reject
    const isRealEstate = labels.some((label) => realEstateRoomTypes.some((room) => label.includes(room.toLowerCase())));
    if (!isRealEstate) {
      return { rejected: true, reason: 'Image does not appear to be a real estate image', labels };
    }
    return { rejected: false };
  } catch (error) {
    // If Rekognition fails, do not reject by default
    return { rejected: false };
  }
}

export default new ContactDetectionService();
