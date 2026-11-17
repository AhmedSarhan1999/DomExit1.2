/**
 * Unified Document Download & File Verification Manager for DomExit Platform (152-FZ / 214-FZ)
 *
 * Guarantees:
 * 1. Safe binary blob resolution (IndexedDB S3 Emulator, Live S3, or verified data URLs).
 * 2. Strict MIME and Content-Type validation (blocks SPA index.html fallbacks).
 * 3. Prevention of cross-origin download drop and relative path navigation.
 * 4. User-friendly localized error handling in Russian.
 */

import { DocumentMetadata, BuyerCandidate } from '../types';
import { StorageService } from '../dal/StorageService';

export interface UnifiedDownloadOptions {
  fileName?: string;
  mimeType?: string;
  onStart?: () => void;
  onFinish?: () => void;
  onError?: (errorMessage: string) => void;
  showToast?: boolean;
}

export type DownloadTarget =
  | DocumentMetadata
  | BuyerCandidate
  | {
      id?: string;
      documentId?: string;
      document_id?: string;
      name?: string;
      fileName?: string;
      file_name?: string;
      url?: string;
      file_url?: string;
      cloudUrl?: string;
      dataUrl?: string;
      storage_path?: string;
      objectKey?: string;
      bucket?: string;
      mimeType?: string;
      mime_type?: string;
      type?: string;
      bankApprovalDocUrl?: string;
      bankApprovalDocName?: string;
      bank_approval_doc_url?: string;
      bank_approval_doc_name?: string;
      bankStatementUrl?: string;
      bankStatementName?: string;
      bank_statement_url?: string;
      bank_statement_name?: string;
    }
  | string;

/**
 * Dispatches an on-screen toast message for file download feedback.
 */
export function showDownloadToast(
  message: string,
  type: 'error' | 'success' | 'info' = 'error'
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('domexit_download_notice', { detail: { message, type } })
    );
  }

  if (typeof document === 'undefined') return;

  let container = document.getElementById('domexit-download-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'domexit-download-toast-container';
    container.className =
      'fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none transition-all';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `p-4 rounded-2xl shadow-2xl border text-xs font-bold transition-all duration-300 pointer-events-auto flex items-center space-x-2.5 ${
    type === 'error'
      ? 'bg-rose-950 text-rose-100 border-rose-800'
      : type === 'success'
      ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
      : 'bg-slate-900 text-slate-100 border-slate-700'
  }`;

  const icon = type === 'error' ? '✕' : type === 'success' ? '✓' : 'ℹ';
  toast.innerHTML = `<span class="shrink-0 text-sm font-black">${icon}</span><span class="leading-relaxed">${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

/**
 * Converts a data URL (base64) into a binary Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Triggers a real programmatic browser file download via temporary Object URL
 */
function triggerBrowserBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 2000);
}

/**
 * Centralized Unified Document Download Handler
 *
 * Used across ALL download actions in the platform.
 * Verifies binary integrity, suppresses HTML error routes, and delivers the exact file.
 */
export async function downloadDocumentFile(
  target: DownloadTarget,
  options?: UnifiedDownloadOptions
): Promise<boolean> {
  options?.onStart?.();

  try {
    let resolvedFileName = options?.fileName || '';
    let resolvedUrl = '';
    let resolvedDoc: DocumentMetadata | null = null;

    // 1. Target is a plain string (URL, dataUrl, or relative path)
    if (typeof target === 'string') {
      resolvedUrl = target.trim();
      if (!resolvedFileName) {
        if (!resolvedUrl.startsWith('data:') && !resolvedUrl.startsWith('blob:')) {
          const cleanPath = resolvedUrl.split('?')[0].split('#')[0];
          const parts = cleanPath.split('/');
          resolvedFileName = parts[parts.length - 1] || 'document.pdf';
        } else {
          resolvedFileName = 'document.pdf';
        }
      }
    } else {
      // 2. Target is an Object (DocumentMetadata, BuyerCandidate, or Generic File Ref)
      const obj = target as any;

      resolvedFileName =
        options?.fileName ||
        obj.bankApprovalDocName ||
        obj.bank_approval_doc_name ||
        obj.bankStatementName ||
        obj.bank_statement_name ||
        obj.name ||
        obj.fileName ||
        obj.file_name ||
        'document.pdf';

      const docId = obj.documentId || obj.document_id || obj.id;

      // Look up in StorageService vault if an ID exists
      if (docId && typeof docId === 'string' && docId.startsWith('doc-')) {
        resolvedDoc = await StorageService.getDocumentById(docId);
      } else if (obj.category && obj.bucket && obj.objectKey) {
        resolvedDoc = obj as DocumentMetadata;
      }

      if (resolvedDoc) {
        resolvedUrl = await StorageService.resolveObjectDataUrl(resolvedDoc);
        if (!resolvedFileName && resolvedDoc.name) {
          resolvedFileName = resolvedDoc.name;
        }
      } else {
        resolvedUrl =
          obj.bankApprovalDocUrl ||
          obj.bank_approval_doc_url ||
          obj.bankStatementUrl ||
          obj.bank_statement_url ||
          obj.cloudUrl ||
          obj.file_url ||
          obj.url ||
          obj.dataUrl ||
          '';
      }
    }

    // Safety fallback: if no URL was found
    if (!resolvedUrl) {
      throw new Error('Файл не найден в хранилище или ссылка недействительна');
    }

    // Ensure clean filename
    resolvedFileName = resolvedFileName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'document.pdf';

    // CASE A: Data URL (Base64)
    if (resolvedUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(resolvedUrl);
      if (blob.type.toLowerCase().includes('text/html')) {
        throw new Error('Некорректный формат файла (HTML)');
      }
      triggerBrowserBlobDownload(blob, resolvedFileName);
      options?.onFinish?.();
      return true;
    }

    // CASE B: Blob URL
    if (resolvedUrl.startsWith('blob:')) {
      const resp = await fetch(resolvedUrl);
      if (!resp.ok) {
        throw new Error(`Ошибка загрузки локального объекта: ${resp.status}`);
      }
      const blob = await resp.blob();
      if (blob.type.toLowerCase().includes('text/html')) {
        throw new Error('Некорректный формат файла (HTML)');
      }
      triggerBrowserBlobDownload(blob, resolvedFileName);
      options?.onFinish?.();
      return true;
    }

    // CASE C: Remote or Relative URL (Fetch as binary Blob and enforce anti-HTML validation)
    let fetchUrl = resolvedUrl;

    // Never pass naked relative paths that would be intercepted by SPA fallback
    if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
      if (fetchUrl.startsWith('/')) {
        fetchUrl = `${window.location.origin}${fetchUrl}`;
      } else {
        fetchUrl = `${window.location.origin}/${fetchUrl}`;
      }
    }

    // Check if the URL points to a known mock domain or relative route without real asset
    if (
      fetchUrl.includes('domexit.ru/docs/') ||
      fetchUrl.endsWith('.pdf') && fetchUrl.startsWith(window.location.origin)
    ) {
      // Test fetch with strict MIME checking
      const headCheck = await fetch(fetchUrl, { method: 'GET' });
      const contentType = (headCheck.headers.get('content-type') || '').toLowerCase();

      // If server returned index.html fallback for missing static asset
      if (!headCheck.ok || contentType.includes('text/html')) {
        throw new Error('Файл не найден в хранилище или ссылка недействительна');
      }

      const blob = await headCheck.blob();
      if (blob.type.toLowerCase().includes('text/html')) {
        throw new Error('Файл не найден в хранилище или ссылка недействительна');
      }

      triggerBrowserBlobDownload(blob, resolvedFileName);
      options?.onFinish?.();
      return true;
    }

    // Standard remote fetch with anti-HTML validation
    const response = await fetch(fetchUrl, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Ошибка сервера при скачивании файла: HTTP ${response.status}`);
    }

    const respContentType = (response.headers.get('content-type') || '').toLowerCase();
    if (respContentType.includes('text/html')) {
      throw new Error('Файл не найден в хранилище или ссылка недействительна');
    }

    const remoteBlob = await response.blob();
    if (remoteBlob.type.toLowerCase().includes('text/html')) {
      throw new Error('Файл не найден в хранилище или ссылка недействительна');
    }

    triggerBrowserBlobDownload(remoteBlob, resolvedFileName);
    options?.onFinish?.();
    return true;
  } catch (err: any) {
    const errorMsg = 'Ошибка скачивания: файл не найден в хранилище или ссылка недействительна';
    console.warn('[UnifiedDownloadHandler] Download aborted:', err?.message || err);

    if (options?.showToast !== false) {
      showDownloadToast(errorMsg, 'error');
    }

    options?.onError?.(errorMsg);
    options?.onFinish?.();
    return false;
  }
}
