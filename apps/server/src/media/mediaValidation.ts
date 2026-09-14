import { extname } from "node:path";
import { fileTypeFromFile } from "file-type";
import type { MediaCategory } from "../db/repositories/mediaRepository.js";

export class MediaValidationError extends Error {
  readonly statusCode = 415;
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

type AllowedMedia = {
  category: MediaCategory;
  extensions: readonly string[];
  storedExtension: string;
};

const ALLOWED: Record<string, AllowedMedia> = {
  "image/png": { category: "images", extensions: [".png"], storedExtension: ".png" },
  "image/jpeg": { category: "images", extensions: [".jpg", ".jpeg", ".jpe"], storedExtension: ".jpg" },
  "image/webp": { category: "images", extensions: [".webp"], storedExtension: ".webp" },
  "video/mp4": { category: "videos", extensions: [".mp4"], storedExtension: ".mp4" },
  "video/webm": { category: "videos", extensions: [".webm"], storedExtension: ".webm" },
  "application/pdf": { category: "pdf", extensions: [".pdf"], storedExtension: ".pdf" },
};

export type ValidatedMediaType = AllowedMedia & { mimeType: string };

export async function validateMediaFile(path: string, originalName: string): Promise<ValidatedMediaType> {
  const detected = await fileTypeFromFile(path);
  if (!detected) throw new MediaValidationError("Jenis file tidak dikenali");
  const allowed = ALLOWED[detected.mime];
  if (!allowed) throw new MediaValidationError("Jenis file tidak didukung");

  const extension = extname(originalName).toLowerCase();
  if (!allowed.extensions.includes(extension)) {
    throw new MediaValidationError("Ekstensi file tidak sesuai dengan isi file");
  }

  return { ...allowed, mimeType: detected.mime };
}
