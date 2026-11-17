/**
 * Binary File Signature & Magic Bytes Validator (DomExit Shield 3 & Item 14)
 * Inspects raw binary header bytes to prevent disguised executables/scripts (e.g. .exe/.html disguised as .pdf).
 */

export interface ValidationResult {
  valid: boolean;
  detectedType?: string;
  error?: string;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOC_BYTES = 15 * 1024 * 1024;   // 15 MB

/**
 * Validates a file's binary header (Magic Bytes) and enforces strict size limits.
 */
export async function validateFileSignature(file: File): Promise<ValidationResult> {
  // 1. Strict Size Checks
  const isImage = file.type.startsWith('image/');
  const maxAllowedBytes = isImage ? MAX_IMAGE_BYTES : MAX_DOC_BYTES;

  if (file.size > maxAllowedBytes) {
    const maxMb = maxAllowedBytes / (1024 * 1024);
    return {
      valid: false,
      error: `Размер файла (${(file.size / (1024 * 1024)).toFixed(1)} МБ) превышает лимит ${maxMb} МБ`,
    };
  }

  // 2. Reject executable & dangerous file extensions immediately
  const lowerName = file.name.toLowerCase();
  const dangerousExts = ['.exe', '.sh', '.bat', '.cmd', '.js', '.vbs', '.msi', '.html', '.htm', '.php', '.py', '.svg'];
  if (dangerousExts.some((ext) => lowerName.endsWith(ext))) {
    return {
      valid: false,
      error: `Загрузка исполняемых и скриптовых файлов (${lowerName.split('.').pop()}) строго запрещена политикой безопасности (152-ФЗ)`,
    };
  }

  // 3. Inspect Binary Magic Bytes
  try {
    const headerBuffer = await file.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);

    // PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { valid: true, detectedType: 'application/pdf' };
    }

    // JPEG Magic Bytes: 0xFF 0xD8 0xFF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true, detectedType: 'image/jpeg' };
    }

    // PNG Magic Bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return { valid: true, detectedType: 'image/png' };
    }

    // WebP Magic Bytes: RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { valid: true, detectedType: 'image/webp' };
    }

    return {
      valid: false,
      error: 'Файл поврежден или имеет недопустимую бинарную сигнатуру. Разрешены только подлинные PDF, JPG, PNG и WebP.',
    };
  } catch (err) {
    return {
      valid: false,
      error: 'Ошибка верификации бинарной структуры файла',
    };
  }
}
