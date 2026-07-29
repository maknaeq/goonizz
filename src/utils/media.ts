import { randomUUID } from 'crypto';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { Media } from '../entities/Media.js';
import { ffmpeg, probeMedia, runFfmpeg } from './ffmpeg.js';

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

// Upload-time compression targets: images are capped at 1080p, video re-encoded at up to
// 1080p, audio re-encoded at a bitrate that stays listenable without bloating storage.
const MAX_IMAGE = { width: 1920, height: 1080 };
const MAX_VIDEO_HEIGHT = 1080;
const AUDIO_BITRATE = '192k';

export async function createMedia(
    buffer: Buffer,
    folder: string,
    originalName: string,
    mimetype: string,
    resize?: { width: number; height: number }
): Promise<Media> {
    const dir = path.join(UPLOADS_ROOT, folder);
    await mkdir(dir, { recursive: true });

    if (mimetype.startsWith('image/')) {
        return createImageMedia(buffer, dir, folder, resize);
    }
    if (mimetype.startsWith('video/')) {
        return createVideoMedia(buffer, dir, folder, originalName);
    }
    if (mimetype.startsWith('audio/')) {
        return createAudioMedia(buffer, dir, folder, originalName);
    }

    throw new Error(`Unsupported media type: ${mimetype}`);
}

async function createImageMedia(
    buffer: Buffer,
    dir: string,
    folder: string,
    resize?: { width: number; height: number }
): Promise<Media> {
    const filename = `${randomUUID()}.webp`;
    const image = resize
        ? sharp(buffer).resize(resize.width, resize.height, { fit: 'cover' })
        : sharp(buffer).resize(MAX_IMAGE.width, MAX_IMAGE.height, { fit: 'inside', withoutEnlargement: true });
    const info = await image.webp({ quality: 82 }).toFile(path.join(dir, filename));

    const media = Media.create({
        path: `${folder}/${filename}`,
        mimetype: 'image/webp',
        width: info.width,
        height: info.height,
        size: info.size,
    });
    await media.save();
    return media;
}

async function createVideoMedia(buffer: Buffer, dir: string, folder: string, originalName: string): Promise<Media> {
    const tmpPath = path.join(dir, `${randomUUID()}.tmp${path.extname(originalName)}`);
    await writeFile(tmpPath, buffer);

    const filename = `${randomUUID()}.mp4`;
    const outputPath = path.join(dir, filename);

    try {
        await runFfmpeg(
            ffmpeg(tmpPath)
                .videoFilter(`scale=-2:'min(${MAX_VIDEO_HEIGHT},ih)'`)
                .videoCodec('libx264')
                .outputOptions(['-crf', '23', '-preset', 'veryfast'])
                .audioCodec('aac')
                .audioBitrate('128k'),
            outputPath
        );
    } finally {
        await unlink(tmpPath);
    }

    const [info, stats] = await Promise.all([probeMedia(outputPath), stat(outputPath)]);

    const media = Media.create({
        path: `${folder}/${filename}`,
        mimetype: 'video/mp4',
        width: info.width,
        height: info.height,
        duration: info.duration,
        size: stats.size,
    });
    await media.save();
    return media;
}

async function createAudioMedia(buffer: Buffer, dir: string, folder: string, originalName: string): Promise<Media> {
    const tmpPath = path.join(dir, `${randomUUID()}.tmp${path.extname(originalName)}`);
    await writeFile(tmpPath, buffer);

    const filename = `${randomUUID()}.mp3`;
    const outputPath = path.join(dir, filename);

    try {
        await runFfmpeg(ffmpeg(tmpPath).audioCodec('libmp3lame').audioBitrate(AUDIO_BITRATE), outputPath);
    } finally {
        await unlink(tmpPath);
    }

    const [info, stats] = await Promise.all([probeMedia(outputPath), stat(outputPath)]);

    const media = Media.create({
        path: `${folder}/${filename}`,
        mimetype: 'audio/mpeg',
        duration: info.duration,
        size: stats.size,
    });
    await media.save();
    return media;
}

export async function deleteMedia(media: Media): Promise<void> {
    try {
        await unlink(path.join(UPLOADS_ROOT, media.path));
    } catch {
        // file might already be gone, ignore
    }
    await media.remove();
}
