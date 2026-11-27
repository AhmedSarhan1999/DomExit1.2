/**
 * Client-Side Image Optimizer (Criterion 10: Modern Formats & In-Browser Compression)
 * Compresses images to WebP format with optimal dimensions before uploading to cloud storage.
 * Preserves PDFs and non-image documents untouched.
 */
export function toSafePhotoFilename(rawName: string, ext = 'webp'): string {
  const base = String(rawName || 'photo')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${base || 'photo'}.${ext}`;
}

export async function optimizeAvatarToWebP(
  file: File,
  maxSize = 400,
  quality = 0.85
): Promise<File> {
  return optimizeImageFile(file, maxSize, maxSize, quality);
}

export async function optimizeImageFile(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.82): Promise<File> {
  // If not an image or is SVG, return original file
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  // If already a small WebP, sanitize filename and return
  if (file.type === 'image/webp' && file.size < 500 * 1024) {
    return new File([file], toSafePhotoFilename(file.name, 'webp'), {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(file);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve(file);
      img.onload = () => {
        let width = img.width;
        let height = img.height;

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
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              // Browser canvas failed to export WebP (e.g. older browser or unsupported format)
              // Fallback to high-quality compressed JPEG
              canvas.toBlob(
                (jpegBlob) => {
                  if (!jpegBlob) {
                    resolve(file);
                    return;
                  }
                  resolve(
                    new File([jpegBlob], toSafePhotoFilename(file.name, 'jpg'), {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    })
                  );
                },
                'image/jpeg',
                quality
              );
              return;
            }

            const supportedOrig = ['image/webp', 'image/jpeg', 'image/png'].includes(file.type);
            if (supportedOrig && maxWidth > 500 && blob.size >= file.size) {
              const origExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
              resolve(
                new File([file], toSafePhotoFilename(file.name, origExt), {
                  type: supportedOrig ? file.type : 'image/jpeg',
                  lastModified: Date.now(),
                })
              );
              return;
            }

            const optimizedFile = new File([blob], toSafePhotoFilename(file.name, 'webp'), {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            resolve(optimizedFile);
          },
          'image/webp',
          quality
        );
      };

      if (typeof e.target?.result === 'string') {
        img.src = e.target.result;
      } else {
        resolve(file);
      }
    };

    reader.readAsDataURL(file);
  });
}
