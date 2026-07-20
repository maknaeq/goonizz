import { Request, Response } from 'express';
import { Media } from '../entities/Media.js';
import { resolveImagePath } from '../utils/transformImage.js';
import type { FitEnum } from 'sharp';

const VALID_FITS = ['contain', 'cover', 'fill', 'inside', 'outside'];

export async function getMedia(req: Request, res: Response) {
    const media = await Media.findOne({ where: { id: Number(req.params.id) } });

    if (!media) {
        res.status(404).json({ errors: ['Media not found'] });
        return;
    }

    const width = req.query.width ? Number(req.query.width) : undefined;
    const height = req.query.height ? Number(req.query.height) : undefined;
    const fit = VALID_FITS.includes(req.query.fit as string) ? (req.query.fit as keyof FitEnum) : undefined;

    const filePath = await resolveImagePath(media.path, { width, height, fit });
    res.sendFile(filePath);
}
