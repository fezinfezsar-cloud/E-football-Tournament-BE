const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

/**
 * Validates actual image buffer content via magic numbers/signatures.
 * Supports JPEG, PNG, and WebP formats.
 */
const isValidImageBuffer = (buffer) => {
  if (!buffer || buffer.length < 12) return false;
  
  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  
  // PNG magic bytes: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  
  // WebP magic bytes: RIFF....WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;

  return false;
};

/**
 * Uploads an in-memory image buffer to Cloudinary using authenticated delivery type.
 */
const uploadScreenshotToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(
        new Error('Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured.')
      );
    }

    const folder = options.folder || 'mini-mayhem/payment-screenshots';
    const deliveryType = options.type || 'authenticated';
    const publicId = options.publicId || `payment_${Date.now()}_${Math.round(Math.random() * 1e9)}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        type: deliveryType,
        public_id: publicId,
        resource_type: 'image',
        overwrite: true
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Removes an orphaned asset from Cloudinary.
 */
const deleteScreenshotFromCloudinary = async (publicId, deliveryType = 'authenticated') => {
  if (!publicId || !isCloudinaryConfigured()) return null;

  // Do not attempt to delete local fallback paths if present
  if (publicId.startsWith('/uploads/') || publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return null;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      type: deliveryType || 'authenticated',
      resource_type: 'image',
      invalidate: true
    });
    return result;
  } catch (error) {
    console.error(`Failed to delete orphaned Cloudinary asset (${publicId}):`, error.message);
    return null;
  }
};

/**
 * Generates a short-lived signed delivery URL for viewing an authenticated Cloudinary asset.
 * Default expiration: 3600 seconds (1 hour).
 */
const generateSignedScreenshotUrl = (publicId, deliveryType = 'authenticated', expiresInSeconds = 3600) => {
  if (!publicId) return null;

  // If publicId is a legacy local upload path or external URL, return as is
  if (publicId.startsWith('/uploads/') || publicId.startsWith('http://') || publicId.startsWith('https://')) {
    return publicId;
  }

  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary environment variables are missing.');
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const url = cloudinary.url(publicId, {
    type: deliveryType || 'authenticated',
    resource_type: 'image',
    sign_url: true,
    expires_at: expiresAt,
    secure: true
  });

  return url;
};

module.exports = {
  isValidImageBuffer,
  uploadScreenshotToCloudinary,
  deleteScreenshotFromCloudinary,
  generateSignedScreenshotUrl
};
