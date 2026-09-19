// ═══════════════════════════════════════════════════════════════════
// PoolNear — File Upload Service
// Supabase Storage uploads for order proofs and payment proofs
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'order-proofs';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export interface UploadResult {
  url: string;
  path: string;
}

export interface UploadError {
  message: string;
  code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'NOT_AUTHENTICATED';
}

/**
 * Validate a file before upload.
 */
function validateFile(file: File): UploadError | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      message: `Invalid file type. Allowed: JPEG, PNG, WebP, HEIC, PDF.`,
      code: 'INVALID_TYPE',
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      message: `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
      code: 'FILE_TOO_LARGE',
    };
  }
  return null;
}

/**
 * Upload order proof image to Supabase Storage.
 * Files are stored under: {userId}/{poolId}/{timestamp}_{filename}
 */
export async function uploadOrderProof(
  file: File,
  userId: string,
  poolId: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const validationError = validateFile(file);
  if (validationError) {
    throw new Error(validationError.message);
  }

  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${poolId}/${timestamp}_proof.${ext}`;

  // Signal progress start
  onProgress?.(10);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  onProgress?.(80);

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get signed URL
  const { data: urlData, error: _signError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours for current session

  onProgress?.(100);

  return {
    url: urlData?.signedUrl || '',
    path: filePath,
  };
}

/**
 * Upload payment proof image.
 */
export async function uploadPaymentProof(
  file: File,
  userId: string,
  poolId: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const validationError = validateFile(file);
  if (validationError) {
    throw new Error(validationError.message);
  }

  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${poolId}/${timestamp}_payment.${ext}`;

  onProgress?.(10);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  onProgress?.(80);

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: urlData, error: _signError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 60 * 60 * 24);

  onProgress?.(100);

  return {
    url: urlData?.signedUrl || '',
    path: filePath,
  };
}

/**
 * Get a temporary signed URL for viewing a private proof.
 */
export async function getSignedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  // If it's already a full URL (legacy), just return it
  if (path.startsWith('http')) return path;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.error('Error getting signed URL:', error.message);
    return null;
  }
  return data.signedUrl;
}

export { MAX_FILE_SIZE, ALLOWED_TYPES };
