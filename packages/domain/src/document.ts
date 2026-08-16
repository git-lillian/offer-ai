/**
 * Documents domain — uploaded files and their lifecycle.
 *
 * Documents live in private storage buckets; only the metadata is stored
 * relationally. Access is based on ownership / explicit grants.
 */

export const DOCUMENT_PROCESSING_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type DocumentProcessingStatus = (typeof DOCUMENT_PROCESSING_STATUSES)[number];

export const DOCUMENT_VISIBILITIES = [
  "private",
  "granted",
] as const;

export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number];

export interface StudentDocument {
  id: string;
  studentId: string;
  ownerUserId: string;
  fileType: string;
  mimeType: string;
  originalFilename: string;
  storagePath: string;
  checksum: string;
  sizeBytes: number;
  uploadSource: string;
  processingStatus: DocumentProcessingStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function isDocumentProcessingStatus(
  value: string,
): value is DocumentProcessingStatus {
  return (DOCUMENT_PROCESSING_STATUSES as readonly string[]).includes(value);
}
