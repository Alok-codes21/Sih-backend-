import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

// Configure Cloudinary if environment variables exist
const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

let configured = false;
export const ensureCloudinaryConfigured = () => {
  if (configured) return true;
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    configured = true;
    logger.info('Cloudinary configured successfully');
    return true;
  }
  return false;
};

// Initial check
ensureCloudinaryConfigured();

/**
 * Uploads a file to Cloudinary if configured, or keeps local storage as fallback.
 *
 * @param {Object} file - Multer file object
 * @param {string} folder - Target folder name (e.g. 'athletes', 'certificates', 'videos')
 * @returns {Promise<{fileUrl: string, publicId: string, storage: string}>}
 */
export const uploadMediaFile = async (file, folder = 'athleteconnect') => {
  if (!file) {
    throw new Error('No file provided for upload');
  }

  // 1. If Cloudinary is configured, upload to Cloudinary
  if (ensureCloudinaryConfigured()) {
    try {
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'auto';
      
      const result = await cloudinary.uploader.upload(file.path, {
        folder: `athleteconnect/${folder}`,
        resource_type: resourceType
      });

      // Remove local temporary file after successful Cloudinary upload
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupErr) {
        logger.warn('Failed to delete temporary local file after Cloudinary upload', { error: cleanupErr.message });
      }

      logger.info('File uploaded to Cloudinary', { publicId: result.public_id, url: result.secure_url });
      return {
        fileUrl: result.secure_url,
        publicId: result.public_id,
        storage: 'cloudinary',
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      logger.error('Cloudinary upload failed, falling back to local file', { error: error.message });
      // Fall through to local fallback
    }
  }

  // 2. Local disk fallback
  const filename = path.basename(file.path);
  const fileUrl = `/uploads/${filename}`;
  
  return {
    fileUrl,
    publicId: filename,
    storage: 'local',
    format: path.extname(file.originalname).replace('.', ''),
    bytes: file.size
  };
};
