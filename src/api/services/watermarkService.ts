// import sharp from 'sharp';
// import path from 'path';
// import fs from 'fs';

// export interface WatermarkOptions {
//   size?: number; // Percentage of image width (default: 20)
//   position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center';
//   padding?: number; // Padding from edges (default: 20)
//   opacity?: number; // Opacity of watermark (0-1, default: 1)
//   quality?: number; // JPEG quality (default: 90)
// }

// export interface WatermarkResult {
//   success: boolean;
//   watermarkedBuffer: Buffer;
//   originalSize: number;
//   watermarkedSize: number;
//   watermarkApplied: boolean;
//   error?: string;
//   metadata?: {
//     watermarkWidth: number;
//     watermarkHeight: number;
//     position: { x: number; y: number };
//   };
// }

// class WatermarkService {
//   private watermarkPath: string;
//   private defaultOptions: WatermarkOptions = {
//     size: 20,
//     position: 'bottom-left',
//     padding: 20,
//     opacity: 1,
//     quality: 90
//   };

//   constructor() {
//     // Use process.cwd() to get the project root and build the path from there
//     this.watermarkPath = path.join(process.cwd(), 'src/api/controllers/property/watermark.svg');
//   }

//   /**
//    * Check if watermarking is enabled via environment variable
//    */
//   private isWatermarkingEnabled(): boolean {
//     const watermarkEnabled = process.env.IMAGE_WATERMARK_ENABLED;
//     return !(watermarkEnabled === 'false' || watermarkEnabled === '0' || watermarkEnabled === 'no');
//   }

//   /**
//    * Check if watermark file exists
//    */
//   private watermarkFileExists(): boolean {
//     return fs.existsSync(this.watermarkPath);
//   }

//   /**
//    * Calculate watermark position based on image dimensions and options
//    */
//   private calculatePosition(
//     imageWidth: number,
//     imageHeight: number,
//     watermarkWidth: number,
//     watermarkHeight: number,
//     options: WatermarkOptions
//   ): { x: number; y: number } {
//     const padding = options.padding || this.defaultOptions.padding!;
//     const position = options.position || this.defaultOptions.position!;

//     switch (position) {
//       case 'bottom-left':
//         return { x: padding, y: imageHeight - watermarkHeight - padding };
//       case 'bottom-right':
//         return { x: imageWidth - watermarkWidth - padding, y: imageHeight - watermarkHeight - padding };
//       case 'top-left':
//         return { x: padding, y: padding };
//       case 'top-right':
//         return { x: imageWidth - watermarkWidth - padding, y: padding };
//       case 'center':
//         return {
//           x: (imageWidth - watermarkWidth) / 2,
//           y: (imageHeight - watermarkHeight) / 2
//         };
//       default:
//         return { x: padding, y: imageHeight - watermarkHeight - padding };
//     }
//   }

//   /**
//    * Calculate watermark dimensions based on image size and options
//    */
//   private calculateWatermarkDimensions(
//     imageWidth: number,
//     imageHeight: number,
//     options: WatermarkOptions
//   ): { width: number; height: number } {
//     const size = options.size || this.defaultOptions.size!;
//     const watermarkWidth = Math.floor(imageWidth * (size / 100));
//     const watermarkHeight = Math.floor((watermarkWidth * 310) / 1054); // Based on SVG aspect ratio

//     // Ensure minimum watermark size
//     const minWidth = 100;
//     const minHeight = 30;
//     const finalWidth = Math.max(watermarkWidth, minWidth);
//     const finalHeight = Math.max(watermarkHeight, minHeight);

//     return { width: finalWidth, height: finalHeight };
//   }

//   /**
//    * Add watermark to an image buffer
//    */
//   async addWatermark(imageBuffer: Buffer, options: WatermarkOptions = {}): Promise<WatermarkResult> {
//     const originalSize = imageBuffer.length;

//     try {
//       // Check if watermarking is enabled
//       if (!this.isWatermarkingEnabled()) {
//         return {
//           success: true,
//           watermarkedBuffer: imageBuffer,
//           originalSize,
//           watermarkedSize: originalSize,
//           watermarkApplied: false
//         };
//       }

//       // Check if watermark file exists
//       if (!this.watermarkFileExists()) {
//         return {
//           success: false,
//           watermarkedBuffer: imageBuffer,
//           originalSize,
//           watermarkedSize: originalSize,
//           watermarkApplied: false,
//           error: 'Watermark file not found'
//         };
//       }

//       // Read watermark file
//       const watermarkBuffer = fs.readFileSync(this.watermarkPath);

//       // Get image metadata
//       const image = sharp(imageBuffer);
//       const metadata = await image.metadata();

//       if (!metadata.width || !metadata.height) {
//         throw new Error('Unable to get image dimensions');
//       }

//       // Calculate watermark dimensions
//       const { width: watermarkWidth, height: watermarkHeight } = this.calculateWatermarkDimensions(
//         metadata.width,
//         metadata.height,
//         options
//       );

//       // Resize watermark
//       const resizedWatermark = await sharp(watermarkBuffer)
//         .resize(watermarkWidth, watermarkHeight, { fit: 'inside' })
//         .png()
//         .toBuffer();

//       // Calculate position
//       const position = this.calculatePosition(
//         metadata.width,
//         metadata.height,
//         watermarkWidth,
//         watermarkHeight,
//         options
//       );

//       // Prepare composite options
//       const compositeOptions: any = {
//         input: resizedWatermark,
//         top: position.y,
//         left: position.x,
//       };

//       // Add opacity if specified
//       if (options.opacity !== undefined && options.opacity < 1) {
//         compositeOptions.blend = 'multiply';
//       }

//       // Composite watermark onto image
//       const quality = options.quality || this.defaultOptions.quality!;
//       const watermarkedImage = await image
//         .composite([compositeOptions])
//         .jpeg({ quality, progressive: true })
//         .toBuffer();

//       const watermarkedSize = watermarkedImage.length;
//       const watermarkApplied = originalSize !== watermarkedSize;

//       return {
//         success: true,
//         watermarkedBuffer: watermarkedImage,
//         originalSize,
//         watermarkedSize,
//         watermarkApplied,
//         metadata: {
//           watermarkWidth,
//           watermarkHeight,
//           position
//         }
//       };

//     } catch (error) {
//       return {
//         success: false,
//         watermarkedBuffer: imageBuffer,
//         originalSize,
//         watermarkedSize: originalSize,
//         watermarkApplied: false,
//         error: error instanceof Error ? error.message : 'Unknown error'
//       };
//     }
//   }

//   /**
//    * Get watermark service status
//    */
//   getServiceStatus() {
//     return {
//       enabled: this.isWatermarkingEnabled(),
//       watermarkFileExists: this.watermarkFileExists(),
//       watermarkPath: this.watermarkPath,
//       environmentVariable: process.env.IMAGE_WATERMARK_ENABLED
//     };
//   }

//   /**
//    * Get watermark file path
//    */
//   getWatermarkPath(): string {
//     return this.watermarkPath;
//   }

//   /**
//    * Check if watermark file exists (public method)
//    */
//   isWatermarkFileExists(): boolean {
//     return this.watermarkFileExists();
//   }

//   /**
//    * Get image metadata using sharp
//    */
//   async getImageMetadata(imageBuffer: Buffer) {
//     return await sharp(imageBuffer).metadata();
//   }
// }

// // Export singleton instance
// export const watermarkService = new WatermarkService();
// export default watermarkService;
