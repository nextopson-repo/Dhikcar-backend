import { DetectLabelsCommand, DetectModerationLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';

// Interfaces for type safety
interface RekognitionLabel {
  name: string;
  confidence: number;
  instances?: any[];
  parents?: any[];
}

interface RekognitionResult {
  labels: RekognitionLabel[];
  moderationLabels: any[];
  isInappropriate: boolean;
  hasContactInfo: boolean;
  roomType?: string;
  confidence?: number;
}

interface ImageCompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressedBuffer: Buffer;
  url?: string;
}

class AwsRekognitionService {
  private rekognitionClient: RekognitionClient;
  private s3Client: S3Client;
  private bucketName: string;
  private readonly minConfidence: number;
  private readonly maxLabels: number;

  // Room type mapping for Rekognition labels
  private readonly roomTypeMapping = {
    Bathroom: ['bathroom', 'toilet', 'shower', 'bathtub', 'sink', 'mirror'],
    Bedroom: ['bedroom', 'bed', 'mattress', 'pillow', 'nightstand', 'dresser'],
    Kitchen: ['kitchen', 'stove', 'refrigerator', 'microwave', 'sink', 'counter'],
    Livingroom: ['living room', 'sofa', 'couch', 'tv', 'coffee table', 'fireplace'],
    Dining: ['dining room', 'dining table', 'chair', 'table', 'restaurant'],
    Balcony: ['balcony', 'terrace', 'outdoor', 'patio', 'deck'],
    Other: ['room', 'interior', 'furniture', 'appliance'],
  };

  // Inappropriate content labels
  private readonly inappropriateLabels = [
    'Explicit Nudity',
    'Violence',
    'Visually Disturbing',
    'Rude Gestures',
    'Drugs',
    'Tobacco',
    'Alcohol',
    'Gambling',
    'Hate Symbols',
  ];

  // Contact information labels to detect
  private readonly contactLabels = [
    'Phone',
    'Mobile',
    'Call',
    'Contact',
    'Email',
    'Address',
    'Number',
    'WhatsApp',
    'Telegram',
    'Social Media',
    'Instagram',
    'Facebook',
    'Twitter',
    'LinkedIn',
    'YouTube',
    'TikTok',
    'Handle',
    'Username',
    'Profile',
  ];

  constructor() {
    this.rekognitionClient = new RekognitionClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.bucketName = process.env.AWS_S3_BUCKET || '';

    // Get configuration from environment variables
    this.minConfidence = parseInt(process.env.AWS_REKOGNITION_MIN_CONFIDENCE || '70');
    this.maxLabels = parseInt(process.env.AWS_REKOGNITION_MAX_LABELS || '20');
  }

  /**
   * Analyze image using AWS Rekognition for labels and moderation
   */
  async analyzeImage(imageBuffer: Buffer): Promise<RekognitionResult> {
    try {
      console.log('Starting AWS Rekognition analysis...');
      console.log('Configuration:', {
        minConfidence: this.minConfidence,
        maxLabels: this.maxLabels,
        enabled: this.isEnabled(),
      });

      // Detect labels
      const detectLabelsCommand = new DetectLabelsCommand({
        Image: {
          Bytes: imageBuffer,
        },
        MaxLabels: this.maxLabels,
        MinConfidence: this.minConfidence,
      });

      // Detect moderation labels
      const detectModerationCommand = new DetectModerationLabelsCommand({
        Image: {
          Bytes: imageBuffer,
        },
        MinConfidence: this.minConfidence,
      });

      // Execute both commands in parallel
      const [labelsResponse, moderationResponse] = await Promise.all([
        this.rekognitionClient.send(detectLabelsCommand),
        this.rekognitionClient.send(detectModerationCommand),
      ]);

      const labels = labelsResponse.Labels || [];
      const moderationLabels = moderationResponse.ModerationLabels || [];

      console.log(
        'Rekognition labels found:',
        labels.map((l: any) => ({ name: l.Name, confidence: l.Confidence }))
      );
      console.log(
        'Moderation labels found:',
        moderationLabels.map((l: any) => ({ name: l.Name, confidence: l.Confidence }))
      );

      // Check for inappropriate content
      const isInappropriate = this.isInappropriate(labels);

      // Check for contact information
      const hasContactInfo = this.hasContactInfo(labels);

      // Determine room type
      const { roomType, confidence } = this.determineRoomType(labels);

      return {
        labels: labels.map((label) => ({
          name: label.Name || '',
          confidence: label.Confidence || 0,
          instances: label.Instances,
          parents: label.Parents,
        })),
        moderationLabels: moderationLabels.map((label) => ({
          name: label.Name,
          confidence: label.Confidence,
          parentName: label.ParentName,
        })),
        isInappropriate,
        hasContactInfo,
        roomType,
        confidence,
      };
    } catch (error) {
      console.error('AWS Rekognition analysis failed:', error);
      throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compress image using Sharp
   */
  async compressImage(imageBuffer: Buffer, quality: number = 80): Promise<ImageCompressionResult> {
    try {
      // Check if image compression is enabled
      if (process.env.IMAGE_COMPRESSION_ENABLED !== 'true') {
        console.log('Image compression is disabled via environment variable');
        return {
          originalSize: imageBuffer.length,
          compressedSize: imageBuffer.length,
          compressionRatio: 0,
          compressedBuffer: imageBuffer,
        };
      }

      console.log('Starting image compression...');
      const originalSize = imageBuffer.length;

      // Use environment variable for default quality if not provided
      const compressionQuality = quality || parseInt(process.env.IMAGE_COMPRESSION_QUALITY || '80');

      // Compress image using Sharp
      const compressedBuffer = await sharp(imageBuffer)
        .jpeg({ quality: compressionQuality, progressive: true })
        .resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer();

      const compressedSize = compressedBuffer.length;
      const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

      console.log('Image compression completed:', {
        originalSize: `${(originalSize / 1024).toFixed(2)} KB`,
        compressedSize: `${(compressedSize / 1024).toFixed(2)} KB`,
        compressionRatio: `${compressionRatio.toFixed(2)}%`,
        quality: compressionQuality,
      });

      return {
        originalSize,
        compressedSize,
        compressionRatio,
        compressedBuffer,
      };
    } catch (error) {
      console.error('Image compression failed:', error);
      throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload compressed image to S3
   */
  async uploadCompressedImage(compressedBuffer: Buffer, key: string, contentType: string): Promise<string> {
    try {
      console.log('Uploading compressed image to S3...');

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: compressedBuffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000', // 1 year cache
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      console.log('Compressed image uploaded successfully:', url);

      return url;
    } catch (error) {
      console.error('Failed to upload compressed image:', error);
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate presigned URL for image upload
   */
  async generatePresignedUrl(key: string, contentType: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      throw new Error(`Presigned URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine room type based on Rekognition labels
   */
  private determineRoomType(labels: any[]): { roomType: string; confidence: number } {
    let bestMatch = { roomType: 'Other', confidence: 0 };

    for (const [roomType, keywords] of Object.entries(this.roomTypeMapping)) {
      for (const keyword of keywords) {
        const match = labels.find((label) => label.Name && label.Name.toLowerCase().includes(keyword.toLowerCase()));
        if (match && match.Confidence > bestMatch.confidence) {
          bestMatch = { roomType, confidence: match.Confidence };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get confidence score for room type classification
   */
  private getRoomTypeConfidence(labels: any[], roomType: string): number {
    const keywords = this.roomTypeMapping[roomType as keyof typeof this.roomTypeMapping] || [];
    // const labelNames = labels.map((l) => l.Name?.toLowerCase() || '');

    let totalConfidence = 0;
    let matchCount = 0;

    for (const keyword of keywords) {
      const matchingLabels = labels.filter((label) => label.Name?.toLowerCase().includes(keyword));

      if (matchingLabels.length > 0) {
        const maxConfidence = Math.max(...matchingLabels.map((l) => l.Confidence || 0));
        totalConfidence += maxConfidence;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalConfidence / matchCount : 0;
  }

  /**
   * Check for inappropriate content
   */
  private isInappropriate(labels: any[]): boolean {
    return labels.some((label: any) => this.inappropriateLabels.includes(label.Name || ''));
  }

  /**
   * Check for contact information
   */
  private hasContactInfo(labels: any[]): boolean {
    return labels.some((label: any) => this.contactLabels.includes(label.Name || ''));
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      this.bucketName
    );
  }

  /**
   * Check if AWS Rekognition is enabled
   */
  isEnabled(): boolean {
    return process.env.AWS_REKOGNITION_ENABLED === 'true';
  }

  /**
   * Get service configuration info
   */
  getConfigInfo(): {
    configured: boolean;
    enabled: boolean;
    region?: string;
    bucket?: string;
    minConfidence: number;
    maxLabels: number;
    compressionEnabled: boolean;
    compressionQuality: number;
  } {
    return {
      configured: this.isConfigured(),
      enabled: this.isEnabled(),
      region: process.env.AWS_REGION,
      bucket: this.bucketName,
      minConfidence: this.minConfidence,
      maxLabels: this.maxLabels,
      compressionEnabled: process.env.IMAGE_COMPRESSION_ENABLED === 'true',
      compressionQuality: parseInt(process.env.IMAGE_COMPRESSION_QUALITY || '80'),
    };
  }
}

export default new AwsRekognitionService();
