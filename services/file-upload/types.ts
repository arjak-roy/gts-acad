export const FILE_UPLOAD_STORAGE_PROVIDERS = ["LOCAL_PUBLIC", "S3"] as const;
export type FileUploadStorageProvider = (typeof FILE_UPLOAD_STORAGE_PROVIDERS)[number];

export const BRANDING_ASSET_SLOTS = ["application-logo", "favicon", "login-page-banner"] as const;
export type BrandingAssetSlot = (typeof BRANDING_ASSET_SLOTS)[number];

export type FileUploadGlobalSettings = {
  maximumFileUploadSizeBytes: number;
  allowedFileTypes: string[];
  allowedImageTypes: string[];
  storageLocation: FileUploadStorageProvider;
  enableDocumentPreview: boolean;
};

export type S3UploadConfig = {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  namingStrategy: string;
  isConfigured: boolean;
};

export type FileUploadRuntimeConfig = {
  globalSettings: FileUploadGlobalSettings;
  s3: S3UploadConfig;
};
