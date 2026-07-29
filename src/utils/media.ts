import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { Media } from '../entities/Media.js';

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

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
        const filename = `${randomUUID()}.webp`;
        const image = resize ? sharp(buffer).resize(resize.width, resize.height, { fit: 'cover' }) : sharp(buffer);
        const info = await image.webp().toFile(path.join(dir, filename));

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

    const filename = `${randomUUID()}${path.extname(originalName)}`;
    await writeFile(path.join(dir, filename), buffer);

    const media = Media.create({
        path: `${folder}/${filename}`,
        mimetype,
        size: buffer.length,
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
