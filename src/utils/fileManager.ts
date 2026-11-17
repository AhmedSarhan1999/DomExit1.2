/**
 * Real Document Upload, Download & Preview Manager for DomExit
 */

import { downloadDocumentFile, UnifiedDownloadOptions } from './downloadManager';

export interface StoredDocument {
  id: string;
  name: string;
  sizeBytes: number;
  size?: number;
  type: string;
  dataUrl?: string;
  file?: File;
  uploadedAt: string;
  category: 'ddu' | 'developer_statement' | 'mortgage_approval' | 'photo' | 'floorplan' | 'other';
}

export class FileManager {
  /**
   * Prompts user with native OS file picker and resolves to a StoredDocument (including native File)
   */
  static selectAndReadFile(
    category: StoredDocument['category'] = 'other',
    accept: string = '.pdf,.png,.jpg,.jpeg,.doc,.docx'
  ): Promise<StoredDocument | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;

      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) {
          resolve(null);
          return;
        }

        const file = target.files[0];
        const reader = new FileReader();

        reader.onload = () => {
          const doc: StoredDocument = {
            id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: file.name,
            sizeBytes: file.size,
            size: file.size,
            type: file.type || 'application/octet-stream',
            dataUrl: reader.result as string,
            file,
            uploadedAt: new Date().toISOString(),
            category,
          };
          resolve(doc);
        };

        reader.onerror = () => {
          resolve(null);
        };

        reader.readAsDataURL(file);
      };

      input.click();
    });
  }

  /**
   * Triggers a real browser file download for any stored document or URL.
   * Uses Unified Document Download Handler with binary MIME validation & HTML prevention.
   */
  static async downloadFile(
    fileNameOrUrl: string,
    contentOrFileName?: string
  ): Promise<boolean> {
    const looksLikeUrl = (v?: string) =>
      !!v &&
      (v.startsWith('data:') ||
        v.startsWith('blob:') ||
        v.startsWith('http://') ||
        v.startsWith('https://') ||
        v.startsWith('/'));

    let target: any = fileNameOrUrl;
    let fileName = '';

    if (looksLikeUrl(fileNameOrUrl) && contentOrFileName && !looksLikeUrl(contentOrFileName)) {
      target = fileNameOrUrl;
      fileName = contentOrFileName;
    } else if (contentOrFileName && looksLikeUrl(contentOrFileName)) {
      target = contentOrFileName;
      fileName = fileNameOrUrl;
    } else {
      target = fileNameOrUrl;
      fileName = contentOrFileName || '';
    }

    return downloadDocumentFile(target, { fileName });
  }

  /**
   * High-level unified document downloader for any object or entity
   */
  static async downloadDocument(
    target: any,
    options?: UnifiedDownloadOptions
  ): Promise<boolean> {
    return downloadDocumentFile(target, options);
  }
}
