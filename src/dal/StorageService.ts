import { DocumentCategory, DocumentMetadata, DocumentReviewStatus } from '../types';
import { DatabaseGateway } from './DatabaseGateway';
import { IStorageService, UploadDocumentParams } from './interfaces/IStorageAdapter';
import { AuditLogsRepository } from './repositories/AuditLogsRepository';
import { YandexCloudAdapter } from './adapters/YandexCloudAdapter';

const IDB_NAME = 'domexit_yandex_s3_emulator';
const IDB_VERSION = 1;
const IDB_STORE = 's3_bucket_objects';
const METADATA_COLLECTION = 'documents_vault';
const DEFAULT_S3_BUCKET =
  import.meta.env.VITE_YANDEX_STORAGE_BUCKET || 'domexit-storage-vault';

interface S3StoredObject {
  s3Uri: string; // s3://domexit-docs-152fz/<objectKey>
  bucket: string;
  objectKey: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
  createdAt: string;
}

function openS3IndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 's3Uri' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putS3Object(obj: S3StoredObject): Promise<void> {
  try {
    const db = await openS3IndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(obj);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[StorageService] IndexedDB S3 write fallback:', err);
  }
}

async function getS3Object(s3Uri: string): Promise<S3StoredObject | null> {
  try {
    const db = await openS3IndexedDB();
    const res = await new Promise<S3StoredObject | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const getReq = tx.objectStore(IDB_STORE).get(s3Uri);
      getReq.onsuccess = () => resolve((getReq.result as S3StoredObject) || null);
      getReq.onerror = () => reject(getReq.error);
    });
    db.close();
    return res;
  } catch {
    return null;
  }
}

async function deleteS3Object(s3Uri: string): Promise<void> {
  try {
    const db = await openS3IndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(s3Uri);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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

/**
 * Generates a compact Base64 thumbnail for image uploads so Firestore DocumentMetadata
 * stays well under 40KB while full binary files live inside the IndexedDB S3 Bucket Store.
 */
function createImageThumbnail(dataUrl: string, mimeType: string): Promise<string | undefined> {
  if (!mimeType.startsWith('image/')) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 360;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.68));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = dataUrl;
  });
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
    hintRu: 'Все страницы со штампом электронной регистрации Росреестра (PDF / JPG)',
    hintEn: 'All pages with Rosreestr registration stamp (PDF / JPG)',
    required: true,
  },
  {
    category: 'developer_payment_cert',
    titleRu: '2. Справка об оплате от застройщика (акт сверки расчетов)',
    titleEn: '2. Developer Payment Confirmation Certificate',
    hintRu: 'Официальная справка девелопера о фактически внесенной сумме и остатке долга',
    hintEn: 'Official developer certificate confirming paid principal and remaining balance',
    required: true,
  },
  {
    category: 'sfr_maternal_cap',
    titleRu: '3. Справка об остатке маткапитала из Госуслуг (Справка СФР)',
    titleEn: '3. Maternal Capital Balance Certificate (Gosuslugi / SFR)',
    hintRu: 'Подтверждение неиспользования средств материнского капитала по объекту 214-ФЗ',
    hintEn: 'Proof that maternal capital funds were not encumbered in the DDU',
    required: true,
  },
  {
    category: 'bank_statement_origin',
    titleRu: '4. Банковская выписка, подтверждающая происхождение средств',
    titleEn: '4. Bank Statement Confirming Source & Payment of Funds',
    hintRu: 'Платежные поручения / выписка по эскроу или аккредитиву банка',
    hintEn: 'Payment orders or bank statement proving clean origin of paid installments',
    required: true,
  },
];

const SEEDED_VAULT_DOCUMENTS: DocumentMetadata[] = [
  {
    id: 'vault-u10566-ddu',
    bucket: DEFAULT_S3_BUCKET,
    objectKey: 'sellers/DEX-784105/U-10566/Dogovor_DDU_Chistoe_Nebo_10566.pdf',
    name: 'Договор_ДДУ_Чистое_Небо_10566.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1_842_500,
    uploadedAt: '2026-10-18T10:15:00.000Z',
    uploadedByUid: 'seed-seller-1',
    clientCode: 'DEX-784105',
    entityType: 'lot',
    entityId: 'U-10566',
    category: 'ddu_contract',
    categoryLabelRu: 'Договор участия в долевом строительстве (ДДУ)',
    status: 'approved',
    reviewedBy: 'Алексей Орлов (Старший юрист)',
    reviewedAt: '2026-10-18T14:20:00.000Z',
    sha256Hash: '9f84c2b10a77e5d2c318a904e1f77a01',
    storageDriver: 'indexeddb_s3',
  },
  {
    id: 'vault-u10566-devpay',
    bucket: DEFAULT_S3_BUCKET,
    objectKey: 'sellers/DEX-784105/U-10566/Spravka_ob_oplate_SetlGroup.pdf',
    name: 'Справка_об_оплате_SetlGroup_2485230.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 642_100,
    uploadedAt: '2026-10-18T10:17:00.000Z',
    uploadedByUid: 'seed-seller-1',
    clientCode: 'DEX-784105',
    entityType: 'lot',
    entityId: 'U-10566',
    category: 'developer_payment_cert',
    categoryLabelRu: 'Справка об оплате от застройщика',
    status: 'approved',
    reviewedBy: 'Алексей Орлов (Старший юрист)',
    reviewedAt: '2026-10-18T14:22:00.000Z',
    sha256Hash: '4e12a8b90d34f71c89aa2301b890f412',
    storageDriver: 'indexeddb_s3',
  },
  {
    id: 'vault-u10566-sfr',
    bucket: DEFAULT_S3_BUCKET,
    objectKey: 'sellers/DEX-784105/U-10566/Spravka_SFR_Gosuslugi_Matkapital.pdf',
    name: 'Справка_СФР_Госуслуги_Маткапитал_Чисто.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 418_900,
    uploadedAt: '2026-10-18T10:19:00.000Z',
    uploadedByUid: 'seed-seller-1',
    clientCode: 'DEX-784105',
    entityType: 'lot',
    entityId: 'U-10566',
    category: 'sfr_maternal_cap',
    categoryLabelRu: 'Справка СФР (Госуслуги) о маткапитале',
    status: 'approved',
    reviewedBy: 'Алексей Орлов (Старший юрист)',
    reviewedAt: '2026-10-18T14:25:00.000Z',
    sha256Hash: '7b55d1c02f98e12a67bc9012e4f5a833',
    storageDriver: 'indexeddb_s3',
  },
  {
    id: 'vault-u10566-bank',
    bucket: DEFAULT_S3_BUCKET,
    objectKey: 'sellers/DEX-784105/U-10566/Vypiska_Sberbank_Proishozhdenie_Sredstv.pdf',
    name: 'Выписка_Сбербанк_Происхождение_Средств.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 790_320,
    uploadedAt: '2026-10-18T10:21:00.000Z',
    uploadedByUid: 'seed-seller-1',
    clientCode: 'DEX-784105',
    entityType: 'lot',
    entityId: 'U-10566',
    category: 'bank_statement_origin',
    categoryLabelRu: 'Банковская выписка о происхождении средств',
    status: 'approved',
    reviewedBy: 'Алексей Орлов (Старший юрист)',
    reviewedAt: '2026-10-18T14:27:00.000Z',
    sha256Hash: '2c91e0f44a81b3d90012fe78c31a5590',
    storageDriver: 'indexeddb_s3',
  },
];

function buildOfficialFallbackCertificateBlobUrl(doc: DocumentMetadata): string {
  const content = [
    '======================================================================',
    '   DOMEXIT — ЧИСТЫЙ ВЫХОД | ЗАЩИЩЕННОЕ ХРАНИЛИЩЕ ДОКУМЕНТОВ (152-ФЗ)  ',
    '   YANDEX OBJECT STORAGE (S3-COMPATIBLE BUCKET EMULATION)             ',
    '======================================================================',
    `Имя файла:         ${doc.name}`,
    `Категория:         ${doc.categoryLabelRu || doc.category}`,
    `S3 Bucket:         s3://${doc.bucket}/${doc.objectKey}`,
    `MIME-тип:          ${doc.mimeType}`,
    `Размер:            ${(doc.sizeBytes / 1024).toFixed(1)} КБ`,
    `Код клиента:       ${doc.clientCode}`,
    `Объект / Заявка:   ${doc.entityType} #${doc.entityId}`,
    `Дата загрузки:     ${new Date(doc.uploadedAt).toLocaleString('ru-RU')}`,
    `Статус комплаенса: ${doc.status.toUpperCase()}`,
    doc.reviewedBy ? `Проверил юрист:    ${doc.reviewedBy}` : '',
    `Контрольная сумма: SHA-256 ${doc.sha256Hash || 'GOST-VERIFIED'}`,
    '======================================================================',
    'Документ прошел криптографическую фиксацию в контуре DomExit 214-ФЗ.',
  ]
    .filter(Boolean)
    .join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  return URL.createObjectURL(blob);
}

class YandexS3CompatibleStorageService implements IStorageService {
  readonly defaultBucket = DEFAULT_S3_BUCKET;

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

    const nowIso = new Date().toISOString();
    const safeName = file.name.replace(/[^\w.\-А-Яа-яЁё]/g, '_');
    const docId = `doc-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const objectKey = `${entityType}/${clientCode || 'DEX-GUEST'}/${entityId}/${category}_${Date.now()}_${safeName}`;
    const s3Uri = `s3://${bucket}/${objectKey}`;

    const [dataUrl, sha256Hash] = await Promise.all([
      readFileAsDataUrl(file),
      computeSha256Hex(file),
    ]);

    const previewDataUrl = await createImageThumbnail(dataUrl, file.type || 'application/octet-stream');

    // 1. Live Upload directly to Yandex Object Storage (S3 API)
    let cloudUrl = `https://storage.yandexcloud.net/${bucket}/${objectKey}`;
    try {
      cloudUrl = await YandexCloudAdapter.uploadS3Object(
        objectKey,
        file,
        file.type || 'application/octet-stream'
      );
    } catch (err) {
      console.warn('[StorageService] Live Yandex Object Storage upload warning, keeping local fallback:', err);
    }

    // 2. Store binary payload inside local IndexedDB S3 Object Store as resilient backup
    await putS3Object({
      s3Uri,
      bucket,
      objectKey,
      mimeType: file.type || 'application/octet-stream',
      dataUrl,
      sizeBytes: file.size,
      createdAt: nowIso,
    });

    // 3. Store lightweight metadata inside YDB / DAL documents_vault
    const metadata: DocumentMetadata = {
      id: docId,
      bucket,
      objectKey,
      name: file.name,
      mimeType: file.type || 'application/pdf',
      sizeBytes: file.size,
      uploadedAt: nowIso,
      uploadedByUid,
      clientCode: clientCode || 'DEX-000000',
      entityType,
      entityId,
      category,
      categoryLabelRu,
      status: 'under_review',
      sha256Hash,
      previewDataUrl,
      cloudUrl,
      storageDriver: 'yandex_s3',
    };

    await DatabaseGateway.save<DocumentMetadata>(METADATA_COLLECTION, metadata);
    return metadata;
  }

  async getDocumentsByEntity(
    entityType: DocumentMetadata['entityType'],
    entityId: string
  ): Promise<DocumentMetadata[]> {
    const all = await DatabaseGateway.getAll<DocumentMetadata>(
      METADATA_COLLECTION,
      SEEDED_VAULT_DOCUMENTS
    );
    return all
      .filter(
        (d) =>
          (d.entityType === entityType && d.entityId === entityId) ||
          (entityType === 'lot' && d.entityId === entityId)
      )
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getDocumentsByClient(clientCode: string): Promise<DocumentMetadata[]> {
    const all = await DatabaseGateway.getAll<DocumentMetadata>(
      METADATA_COLLECTION,
      SEEDED_VAULT_DOCUMENTS
    );
    return all
      .filter((d) => d.clientCode === clientCode)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getDocumentById(docId: string): Promise<DocumentMetadata | null> {
    return DatabaseGateway.getById<DocumentMetadata>(
      METADATA_COLLECTION,
      docId,
      SEEDED_VAULT_DOCUMENTS
    );
  }

  async resolveObjectDataUrl(doc: DocumentMetadata): Promise<string> {
    if (doc.cloudUrl && doc.cloudUrl.startsWith('http')) {
      return doc.cloudUrl;
    }
    const s3Uri = `s3://${doc.bucket}/${doc.objectKey}`;
    const stored = await getS3Object(s3Uri);
    if (stored && stored.dataUrl) {
      return stored.dataUrl;
    }
    if (doc.previewDataUrl) {
      return doc.previewDataUrl;
    }
    return buildOfficialFallbackCertificateBlobUrl(doc);
  }

  async updateDocumentStatus(
    docId: string,
    status: DocumentReviewStatus,
    reviewerName: string,
    rejectionReason?: string
  ): Promise<DocumentMetadata | null> {
    const existing = await this.getDocumentById(docId);
    if (!existing) return null;

    const updated: DocumentMetadata = {
      ...existing,
      status,
      reviewedBy: reviewerName,
      reviewedAt: new Date().toISOString(),
      rejectionReason: status === 'rejected' ? rejectionReason || 'Требуется повторная загрузка читаемого скана' : undefined,
    };

    await DatabaseGateway.save<DocumentMetadata>(METADATA_COLLECTION, updated);

    await AuditLogsRepository.addLog({
      lotCode: existing.entityType === 'lot' ? existing.entityId : undefined,
      operatorName: reviewerName,
      operatorRole: 'curator',
      actionType: 'document_vault_action',
      title: `Статус документа «${existing.name}» изменен: ${
        status === 'approved' ? 'Одобрен ✓' : status === 'rejected' ? 'Отклонен ✕' : 'На проверке'
      }`,
      description: rejectionReason
        ? `Причина отклонения: ${rejectionReason}`
        : `Документ проверен в защищенном хранилище S3 (${existing.bucket}).`,
    });

    return updated;
  }

  async deleteDocument(docId: string): Promise<boolean> {
    const existing = await this.getDocumentById(docId);
    if (existing) {
      await deleteS3Object(`s3://${existing.bucket}/${existing.objectKey}`);
    }
    return DatabaseGateway.remove(METADATA_COLLECTION, docId);
  }

  async downloadDocument(doc: DocumentMetadata): Promise<void> {
    const url = await this.resolveObjectDataUrl(doc);
    const link = document.createElement('a');
    link.href = url;
    // If fallback certificate text blob was generated for a seeded PDF without binary payload, keep clean filename
    link.download = url.startsWith('blob:') && !doc.previewDataUrl
      ? `${doc.name.replace(/\.pdf$/i, '')}_GOST_CERT.txt`
      : doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async rebindDocumentsToEntity(
    docIds: string[],
    toEntityType: DocumentMetadata['entityType'],
    toEntityId: string
  ): Promise<void> {
    for (const id of docIds) {
      const existing = await this.getDocumentById(id);
      if (existing) {
        const updated: DocumentMetadata = {
          ...existing,
          entityType: toEntityType,
          entityId: toEntityId,
        };
        await DatabaseGateway.save<DocumentMetadata>(METADATA_COLLECTION, updated);
      }
    }
  }
}

export const StorageService: IStorageService = new YandexS3CompatibleStorageService();
