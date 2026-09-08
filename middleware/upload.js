import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ValidationError } from './errorHandler.js';

// Ensure the upload directory exists at startup
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const configuredMaxFileSize = Number.parseInt(process.env.MAX_FILE_SIZE || '', 10);
const maxFileSize = Number.isFinite(configuredMaxFileSize) && configuredMaxFileSize > 0
  ? configuredMaxFileSize
  : 10 * 1024 * 1024;
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
  // Ignore if already exists or permissions issue — multer will surface the error at write time
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOAD_DIR || './uploads';
    // Ensure directory exists on each upload (handles dynamic UPLOAD_DIR changes)
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new ValidationError('Only image files are allowed!'), false);
  }
};

const certFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new ValidationError('Only image and PDF files are allowed!'), false);
  }
};

const videoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new ValidationError('Only video files are allowed!'), false);
  }
};

const generalMediaFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype.startsWith('video/')
  ) {
    cb(null, true);
  } else {
    cb(new ValidationError('Allowed file types: Images (JPG, PNG, WebP), PDFs, and Videos (MP4, WebM)'), false);
  }
};

export const uploadProfilePhoto = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
}).single('profilePhoto');

export const uploadCertificate = multer({
  storage,
  fileFilter: certFilter,
  limits: { fileSize: maxFileSize }
}).single('certificate');

export const uploadVideo = multer({
  storage,
  fileFilter: videoFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
}).single('video');

export const uploadMedia = multer({
  storage,
  fileFilter: generalMediaFilter,
  limits: { fileSize: maxFileSize }
}).single('file');
