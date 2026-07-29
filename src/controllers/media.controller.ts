import { Request, Response } from 'express';
import { Media } from '../entities/Media.js';
import { UPLOADS_ROOT, createMedia } from '../utils/media.js';
import { resolveImagePath, VALID_FITS } from '../utils/transformMedia.js';
import type { FitEnum } from 'sharp';
import path from 'path';
import '../types/express.js';

export async function getMedia(req: Request, res: Response) {
    const media = await Media.findOne({ where: { id: Number(req.params.id) } });

    if (!media) {
        res.status(404).json({ errors: ['Media not found'] });
        return;
    }

    if (!media.mimetype.startsWith('image/')) {
        res.sendFile(path.join(UPLOADS_ROOT, media.path));
        return;
    }

    const width = req.query.width ? Number(req.query.width) : undefined;
    const height = req.query.height ? Number(req.query.height) : undefined;
    const fit = VALID_FITS.includes(req.query.fit as keyof FitEnum) ? (req.query.fit as keyof FitEnum) : undefined;

    const filePath = await resolveImagePath(media.path, { width, height, fit });
    res.sendFile(filePath);
}

export async function uploadMedia(req: Request, res: Response) {
    if (!req.file) {
        res.status(400).json({ errors: ['No file uploaded'] });
        return;
    }

    const media = await createMedia(req.file.buffer, 'questions', req.file.originalname, req.file.mimetype);

    res.status(201).json({ id: media.id, mimetype: media.mimetype });
}
