/**
 * Client-Side Image Optimizer (Criterion 10: Modern Formats & In-Browser Compression)
 * Compresses images to WebP format with optimal dimensions before uploading to cloud storage.
 * Preserves PDFs and non-image documents untouched.
 */
export async function optimizeImageFile(file: File, maxWidth = 1920, maxHeight = 1080, quality = 0.82): Promise<File> {
  // If not an image or is SVG, return original file
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  // If already a small WebP, no compression needed
  if (file.type === 'image/webp' && file.size < 500 * 1024) {
    return file;
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

        // Calculate aspect-ratio preserved dimensions
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

        // Convert to modern WebP blob
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compression did not reduce size, return original file
              resolve(file);
              return;
            }

            const optimizedName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const optimizedFile = new File([blob], optimizedName, {
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
