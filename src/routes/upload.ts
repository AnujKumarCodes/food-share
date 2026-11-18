import { Router } from 'express';
import multer from 'multer';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { isCloudinaryConfigured, uploadFoodImage } from '../services/cloudinary.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
  },
});

router.post('/', requireAuth, upload.single('image'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const result = await uploadFoodImage(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    return res.status(201).json({
      url: result.url,
      publicId: result.publicId,
      provider: result.provider,
      cloudinaryConfigured: isCloudinaryConfigured(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Image upload failed.';
    console.error('Upload route error:', error);
    return res.status(500).json({ error: msg });
  }
});

export default router;
