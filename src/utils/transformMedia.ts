import { createHash } from 'crypto';
import { mkdirSync } from 'fs';
import { access, mkdir, rm } from 'fs/promises';
import path from 'path';
import sharp, { FitEnum } from 'sharp';
import { UPLOADS_ROOT } from './imageUpload.js';

export const CACHE_ROOT = path.join(process.cwd(), 'cache');

mkdirSync(CACHE_ROOT, { recursive: true });

export const VALID_FITS: (keyof FitEnum)[] = ['contain', 'cover', 'fill', 'inside', 'outside'];

export type ResizeOptions = {
    width?: number;
    height?: number;
    fit?: keyof FitEnum;
};

async function exists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Resizes the media on first request for a given (width, height, fit) combination and
// serves the cached variant afterwards, instead of only ever serving the one size stored
// at upload time. Returns the original file path untouched when no resize is requested.
export async function resolveImagePath(mediaPath: string, options: ResizeOptions): Promise<string> {
    const sourcePath = path.join(UPLOADS_ROOT, mediaPath);

    if (!options.width && !options.height && !options.fit) {
        return sourcePath;
    }

    const key = createHash('sha256').update(JSON.stringify({ mediaPath, ...options })).digest('hex');
    const cachedPath = path.join(CACHE_ROOT, `${key}.webp`);

    if (await exists(cachedPath)) {
        return cachedPath;
    }

    await sharp(sourcePath).resize(options).webp().toFile(cachedPath);
    return cachedPath;
}

export async function clearImageCache(): Promise<void> {
    await rm(CACHE_ROOT, { recursive: true, force: true });
    await mkdir(CACHE_ROOT, { recursive: true });
}
