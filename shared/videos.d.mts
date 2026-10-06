export const MAX_VIDEO_SECONDS: number;
export const MAX_VIDEO_BYTES: number;
export const MAX_VIDEOS: number;
export const VIDEO_CHUNK_BYTES: number;
export const VIDEO_PATH: RegExp;
export const VIDEO_SCHEMAS: string[];
export interface VideoAsset { bytes: Uint8Array; mime: string; duration: number }
export interface VideoStorage { get(id: string): Promise<VideoAsset | null>; put(id: string, asset: VideoAsset): Promise<void> }
export function videoDuration(bytes: Uint8Array): number;
export function validVideos(videos: unknown): boolean;
export function videoResponse(request: Request, id: string, storage: VideoStorage): Promise<Response>;
