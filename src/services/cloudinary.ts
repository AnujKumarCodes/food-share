import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export async function uploadFoodImage(
  buffer: Buffer,
  mimetype: string,
  originalName: string
): Promise<{ url: string; publicId: string; provider: 'cloudinary' | 'local' }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'foodshare';
    const signaturePayload = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    const base64Data = `data:${mimetype};base64,${buffer.toString('base64')}`;
    const form = new URLSearchParams();
    form.append('file', base64Data);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', folder);
    form.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: form,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudinary upload failed: ${errText}`);
    }

    const data = (await response.json()) as { secure_url: string; public_id: string };
    return {
      url: data.secure_url,
      publicId: data.public_id,
      provider: 'cloudinary',
    };
  }

  // Graceful local fallback when Cloudinary credentials are not configured
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
  const filename = `${crypto.randomUUID()}${safeExt}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

  return {
    url: `/uploads/${filename}`,
    publicId: filename,
    provider: 'local',
  };
}
