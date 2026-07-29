import { Router } from 'express';
import { getMedia, uploadMedia } from '../controllers/media.controller.js';
import { checkUser } from '../middlewares/checkUser.js';
import { upload } from '../middlewares/upload.js';

export const mediaRouter = Router();

mediaRouter.get('/:id', getMedia);
mediaRouter.post('/', checkUser, upload.single('file'), uploadMedia);
