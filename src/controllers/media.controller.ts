import { Request, Response } from 'express';
import { Media } from '../entities/Media.js';
import { createMedia } from '../utils/media.js';
import { resolveMediaPath } from '../utils/transformMedia.js';
import '../types/express.js';

export async function getMedia(req: Request, res: Response) {
    const media = await Media.findOne({ where: { id: Number(req.params.id) } });

    if (!media) {
        res.status(404).json({ errors: ['Media not found'] });
        return;
    }

    const filePath = await resolveMediaPath(media, req.query as Record<string, unknown>);
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
