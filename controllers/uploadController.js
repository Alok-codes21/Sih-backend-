import { uploadMediaFile } from '../services/cloudinaryService.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Handles media uploads (images, certificates, exercise videos).
 */
export const handleFileUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('Please select a file to upload');
    }

    const folder = req.body.folder || (
      req.file.mimetype.startsWith('video/') ? 'videos' :
      req.file.mimetype === 'application/pdf' ? 'certificates' : 'photos'
    );

    const uploadResult = await uploadMediaFile(req.file, folder);

    logger.info('File upload successful', {
      user: req.user?.id,
      fileUrl: uploadResult.fileUrl,
      storage: uploadResult.storage
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileUrl: uploadResult.fileUrl,
        publicId: uploadResult.publicId,
        storage: uploadResult.storage,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype
      }
    });
  } catch (error) {
    next(error);
  }
};
