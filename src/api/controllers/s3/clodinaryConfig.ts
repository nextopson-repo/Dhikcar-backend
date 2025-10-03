import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with connection pooling and timeout settings
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  timeout: 20000, // 20 seconds timeout
  upload_preset: undefined, // Use explicit upload parameters
});

// Set max listeners to prevent memory leak warnings
process.setMaxListeners(0);

export default cloudinary;
