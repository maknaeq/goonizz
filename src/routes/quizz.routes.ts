import { Router } from 'express';
import { getQuizzs, createQuizz } from '../controllers/quizz.controller.js';

export const quizzRouter = Router();

quizzRouter.get('/', getQuizzs);
quizzRouter.post('/', createQuizz);
