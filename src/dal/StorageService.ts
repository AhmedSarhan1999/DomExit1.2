import { DocumentCategory, DocumentMetadata, DocumentReviewStatus } from '../types';
import { DatabaseGateway } from './DatabaseGateway';
import { IStorageService, UploadDocumentParams } from './interfaces/IStorageAdapter';
import { AuditLogsRepository } from './repositories/AuditLogsRepository';
import { validateFileSignature } from '../utils/fileSignatureValidator';
import { apiClient } from '../services/apiClient';

const METADATA_COLLECTION = 'documents_vault';
const DEFAULT_S3_BUCKET = 'domexit-private-docs-staging';

async function computeSha256Hex(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  } catch {
    return `gost-${Date.now().toString(16)}`;
  }
}

export const SELLER_MANDATORY_DOC_SLOTS: Array<{
  category: DocumentCategory;
  titleRu: string;
  titleEn: string;
  hintRu: string;
  hintEn: string;
  required: boolean;
}> = [
  {
    category: 'ddu_contract',
    titleRu: '1. Скан договора участия в долевом строительстве (ДДУ)',
    titleEn: '1. Equity Construction Participation Agreement (DDU) Scan',
    hintRu: 'Все страницы со штампом электронной регистрации Росреестра (включая доп. соглашения, если заключались) (PDF / JPG)',
    hintEn: 'All pages with Rosreestr registration stamp including addenda (PDF / JPG)',
    required: true,
  },
  {
    category: 'developer_payment_cert',
    titleRu: '2. Справка об оплате от застройщика (Акт сверки расчётов)',
    titleEn: '2. Developer Payment Confirmation Certificate (Settlement Act)',
    hintRu: 'Официальная справка девелопера о фактически внесенной сумме и подтверждении взаиморасчетов',
    hintEn: 'Official developer certificate confirming paid principal and remaining balance',
    required: true,
  },
  {
    category: 'sfr_maternal_cap',
    titleRu: '3. Справка об остатке маткапитала (СФР / Госуслуги)',
    titleEn: '3. Maternal Capital Balance Certificate (Gosuslugi / SFR)',
    hintRu: 'Опционально — если есть дети. Подтверждение отсутствия использования маткапитала',
    hintEn: 'Optional — if you have children. Confirmation of non-use of maternity capital',
    required: false,
  },
  {
    category: 'additional',
    titleRu: '4. Дополнительные документы (Выписка ЕГРН, платёжные поручения и др.)',
    titleEn: '4. Additional Documents (EGRN Extract, Payment Orders, etc.)',
    hintRu: 'Опционально. Любые сопутствующие документы по объекту или платежам',
    hintEn: 'Optional. Any accompanying documents for the property or payments',
    required: false,
  },
];

class YandexS3CompatibleStorageService implements IStorageService {
  readonly defaultBucket = DEFAULT_S3_BUCKET;

  /**
   * Uploads legal document binaries directly to private S3 bucket via presigned PUT.
   */
  async uploadDocument(params: UploadDocumentParams): Promise<DocumentMetadata> {
    const {
      file,
      uploadedByUid,
      clientCode,
      entityType,
      entityId,
      category,
      categoryLabelRu,
      bucket = DEFAULT_S3_BUCKET,
    } = params;

    // Strict Binary Magic Bytes & Size Limits Verification (DomExit Shield 3)
    const signatureCheck = await validateFileSignature(file);
    if (!signatureCheck.valid) {
      throw new Error(signatureCheck.error || 'Недопустимый формат файла');
    }

    const sha256Hash = await computeSha256Hex(file);
    const contentType = file.type || 'application/pdf';

    // 1. Request Presigned Upload URL from backend
    const presignRes = await apiClient.post<{
      success: boolean;
      uploadUrl: string;
      storageKey: string;
      bucketType: string;
      publicUrl: string | null;
    }>('/api/storage/presign-upload', {
      scope: 'document',
      lotCode: entityId,
      fileName: file.name,
      contentType,
      fileSize: file.size,
    });

    if (!presignRes?.uploadUrl) {
      throw new Error('Не удалось получить URL для загрузки документа');
    }

    // 2. Perform direct binary PUT to Yandex Cloud Object Storage
    const putRes = await fetch(presignRes.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });

    if (!putRes.ok) {
      throw new Error(`Ошибка загрузки файла в защищенное хранилище S3 (HTTP ${putRes.status})`);
    }

    const nowIso = new Date().toISOString();
    const docId = `doc-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const objectKey = presignRes.storageKey;
    const s3Uri = `s3://${bucket}/${objectKey}`;

    const metadata: DocumentMetadata = {
      id: docId,
      name: file.name,
      category,
      categoryLabelRu: categoryLabelRu || category,
      mimeType: contentType,
      sizeBytes: file.size,
      uploadedAt: nowIso,
      uploadedByUid,
      clientCode: clientCode || 'DEX-GUEST',
      entityType,
      entityId,
      bucket,
      objectKey,
      status: 'uploaded',
      storageDriver: 'yandex_s3',
      sha256Hash,
    };

    // 3. Save metadata record in documents_vault
    await DatabaseGateway.save(METADATA_COLLECTION, metadata);

    // 4. Log audit event
    try {
      await AuditLogsRepository.addLog({
        lotCode: entityId,
        operatorName: clientCode || uploadedByUid,
        operatorRole: 'client',
        actionType: 'doc_uploaded',
        title: `Загружен документ: ${metadata.name}`,
        description: `Категория: ${metadata.categoryLabelRu}. Хранилище: S3 Private (${bucket}). SHA-256: ${sha256Hash}`,
      });
    } catch {
      // Non-fatal
    }

    return metadata;
  }

  /**
   * Uploads public gallery photos via presigned PUT.
   */
  async uploadPhoto(options: {
    file: Blob | File;
    fileName: string;
    lotCode: string;
    contentType?: string;
  }): Promise<{ publicUrl: string; storageKey: string }> {
    const { file, fileName, lotCode, contentType = 'image/webp' } = options;

    const presignRes = await apiClient.post<{
      success: boolean;
      uploadUrl: string;
      storageKey: string;
      bucketType: string;
      publicUrl: string;
    }>('/api/storage/presign-upload', {
      scope: 'photo',
      lotCode,
      fileName,
      contentType,
      fileSize: file.size,
    });

    if (!presignRes?.uploadUrl) {
      throw new Error('Не удалось получить URL для загрузки фотографии');
    }

    const putRes = await fetch(presignRes.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });

    if (!putRes.ok) {
      throw new Error(`Ошибка загрузки фото в галерею (HTTP ${putRes.status})`);
    }

    return {
      publicUrl: presignRes.publicUrl,
      storageKey: presignRes.storageKey,
    };
  }

  /**
   * Resolves a secure temporary download/preview URL for private S3 documents.
   */
  async resolveObjectDataUrl(doc: DocumentMetadata): Promise<string> {
    if (doc.cloudUrl) return doc.cloudUrl;

    try {
      const res = await apiClient.get<{
        success: boolean;
        downloadUrl: string;
        key: string;
      }>(
        `/api/storage/presign-download?key=${encodeURIComponent(
          doc.objectKey
        )}&lotCode=${encodeURIComponent(doc.entityId)}&filename=${encodeURIComponent(doc.name)}`
      );

      if (res?.downloadUrl) {
        return res.downloadUrl;
      }
    } catch (err: any) {
      console.warn('[StorageService] Error getting presigned download URL:', err.message);
    }

    if (doc.previewDataUrl) return doc.previewDataUrl;
    return '';
  }

  async getDocumentById(docId: string): Promise<DocumentMetadata | null> {
    return DatabaseGateway.getById<DocumentMetadata>(METADATA_COLLECTION, docId);
  }

  async getDocumentsByEntity(
    entityType: DocumentMetadata['entityType'],
    entityId: string
  ): Promise<DocumentMetadata[]> {
    return DatabaseGateway.query<DocumentMetadata>(
      METADATA_COLLECTION,
      (doc) => doc.entityType === entityType && doc.entityId === entityId
    );
  }

  async getDocumentsByClient(clientCode: string): Promise<DocumentMetadata[]> {
    return DatabaseGateway.query<DocumentMetadata>(
      METADATA_COLLECTION,
      (doc) => doc.clientCode === clientCode
    );
  }

  async updateDocumentStatus(
    docId: string,
    status: DocumentReviewStatus,
    reviewerName: string,
    rejectionReason?: string
  ): Promise<DocumentMetadata | null> {
    const doc = await this.getDocumentById(docId);
    if (!doc) return null;

    const updated: DocumentMetadata = {
      ...doc,
      status,
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      rejectionReason: status === 'rejected' ? rejectionReason : undefined,
    };

    return DatabaseGateway.save(METADATA_COLLECTION, updated);
  }

  async deleteDocument(docId: string): Promise<boolean> {
    const doc = await this.getDocumentById(docId);
    if (!doc) return false;

    await DatabaseGateway.remove(METADATA_COLLECTION, docId);

    try {
      await AuditLogsRepository.addLog({
        lotCode: doc.entityId,
        operatorName: 'System',
        operatorRole: 'owner',
        actionType: 'deal_cancelled_relisted',
        title: `Удален документ: ${doc.name}`,
        description: `ID: ${docId}, Категория: ${doc.category}`,
      });
    } catch {}

    return true;
  }

  async downloadDocument(doc: DocumentMetadata): Promise<void> {
    const url = await this.resolveObjectDataUrl(doc);
    if (!url) {
      throw new Error('Не удалось получить защищенную ссылку на документ');
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async rebindDocumentsToEntity(
    docIds: string[],
    toEntityType: DocumentMetadata['entityType'],
    toEntityId: string
  ): Promise<void> {
    for (const id of docIds) {
      const doc = await this.getDocumentById(id);
      if (doc) {
        await DatabaseGateway.save(METADATA_COLLECTION, {
          ...doc,
          entityType: toEntityType,
          entityId: toEntityId,
        });
      }
    }
  }
}

export const StorageService = new YandexS3CompatibleStorageService();
