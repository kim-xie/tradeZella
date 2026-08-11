// Cloudinary 客户端直传工具
// 使用 Unsigned Upload Preset，无需后端签名

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.warn(
        '[Cloudinary] Missing VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET. ' +
        'Uploads will fail until these env vars are set.'
    );
}

const BASE_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

/**
 * Upload an image file to Cloudinary.
 * Returns the secure_url (https) of the uploaded image.
 */
export async function uploadImage(file: File): Promise<string> {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
        throw new Error('Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.');
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(`${BASE_URL}/image/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Cloudinary image upload failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    return data.secure_url as string;
}

/**
 * Check if a URL is a Cloudinary URL (https).
 * Used to distinguish new Cloudinary URLs from legacy /uploads/ paths.
 */
export function isCloudinaryUrl(url: string): boolean {
    return url.startsWith('https://') || url.startsWith('http://');
}