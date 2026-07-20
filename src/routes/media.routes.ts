import { Router } from 'express';
import { getMedia } from '../controllers/media.controller.js';

export const mediaRouter = Router();

mediaRouter.get('/:id', getMedia);
