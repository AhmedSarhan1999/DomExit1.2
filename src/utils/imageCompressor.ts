/**
 * Client-Side Image Compression & WebP Converter for DomExit
 * Converts uploaded photos to optimized WebP format to reduce upload bandwidth
 * and S3 storage footprints by 70-85% while preserving visual clarity.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  format?: 'image/webp' | 'image/jpeg';
}

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  isCompressed: boolean;
}

export function isImageFile(file: File | string): boolean {
  if (typeof file === 'string') {
    const ext = file.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'webp', 'heic', 'bmp'].includes(ext || '');
  }
  return file.type.startsWith('image/');
}

/**
 * Compresses an image File using HTML Canvas API and returns WebP format.
 * If file is not an image (e.g. PDF document), it is returned untouched.
 */
export async function compressImageToWebP(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  // If not an image (e.g. PDF, Word document), return file unchanged
  if (!isImageFile(file) || file.type === 'application/pdf') {
    return {
      file,
      dataUrl: '',
      width: 0,
      height: 0,
      sizeBytes: file.size,
      isCompressed: false,
    };
  }

  const maxWidth = options.maxWidth || 1600;
  const maxHeight = options.maxHeight || 1600;
  const quality = options.quality ?? 0.82;
  const format = options.format || 'image/webp';

  return new Promise((resolve) => {
    // Read file via FileReader
    const reader = new FileReader();
    reader.onerror = () => {
      // Fallback: return original file on reader error
      resolve({
        file,
        dataUrl: '',
        width: 0,
        height: 0,
        sizeBytes: file.size,
        isCompressed: false,
      });
    };

    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        return resolve({
          file,
          dataUrl: '',
          width: 0,
          height: 0,
          sizeBytes: file.size,
          isCompressed: false,
        });
      }

      const img = new Image();
      img.onerror = () => {
        resolve({
          file,
          dataUrl: src,
          width: 0,
          height: 0,
          sizeBytes: file.size,
          isCompressed: false,
        });
      };

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect-ratio-preserved bounding box
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            file,
            dataUrl: src,
            width,
            height,
            sizeBytes: file.size,
            isCompressed: false,
          });
        }

        // Draw image with smooth rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({
                file,
                dataUrl: src,
                width,
                height,
                sizeBytes: file.size,
                isCompressed: false,
              });
            }

            // Replace extension with .webp
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const newFileName = `${baseName}.webp`;
            const compressedFile = new File([blob], newFileName, {
              type: format,
              lastModified: Date.now(),
            });

            const dataUrl = canvas.toDataURL(format, quality);

            resolve({
              file: compressedFile,
              dataUrl,
              width,
              height,
              sizeBytes: blob.size,
              isCompressed: true,
            });
          },
          format,
          quality
        );
      };

      img.src = src;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Creates a fast lightweight thumbnail (480px, q=0.75) for fast catalog loading.
 */
export async function generateThumbnailWebP(file: File): Promise<CompressedImageResult> {
  return compressImageToWebP(file, {
    maxWidth: 480,
    maxHeight: 480,
    quality: 0.75,
    format: 'image/webp',
  });
}
