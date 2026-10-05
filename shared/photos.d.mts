export const MAX_PHOTO_BYTES: number;
export const PHOTO_ID: RegExp;
export const PHOTO_PATH: RegExp;
export const PHOTO_SCHEMA: string;
export interface PhotoStorage {
  get(id: string): Promise<Uint8Array | null>;
  put(id: string, bytes: Uint8Array): Promise<void>;
}
export function photoResponse(request: Request, id: string, storage: PhotoStorage): Promise<Response>;
