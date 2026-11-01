import { DocumentCategory, DocumentMetadata, DocumentReviewStatus } from '../../types';

export interface UploadDocumentParams {
  file: File;
  uploadedByUid: string;
  clientCode: string;
  entityType: DocumentMetadata['entityType'];
  entityId: string;
  category: DocumentCategory;
  categoryLabelRu?: string;
  bucket?: string;
}

/**
 * Transitional Storage Layer — Standard S3-Compatible Object Storage Contract
 * Emulates Yandex Object Storage (S3 Buckets) via IndexedDB + Metadata Vault today,
 * and swaps directly to Yandex Object Storage S3 REST/SDK in production.
 */
export interface IStorageService {
  readonly defaultBucket: string;

  uploadDocument(params: UploadDocumentParams): Promise<DocumentMetadata>;

  getDocumentsByEntity(
    entityType: DocumentMetadata['entityType'],
    entityId: string
  ): Promise<DocumentMetadata[]>;

  getDocumentsByClient(clientCode: string): Promise<DocumentMetadata[]>;

  getDocumentById(docId: string): Promise<DocumentMetadata | null>;

  resolveObjectDataUrl(doc: DocumentMetadata): Promise<string>;

  updateDocumentStatus(
    docId: string,
    status: DocumentReviewStatus,
    reviewerName: string,
    rejectionReason?: string
  ): Promise<DocumentMetadata | null>;

  deleteDocument(docId: string): Promise<boolean>;

  downloadDocument(doc: DocumentMetadata): Promise<void>;

  rebindDocumentsToEntity(
    docIds: string[],
    toEntityType: DocumentMetadata['entityType'],
    toEntityId: string
  ): Promise<void>;
}

export type IStorageAdapter = IStorageService;
