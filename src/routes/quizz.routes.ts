import { Router } from 'express';
import { getQuizzs, createQuizz } from '../controllers/quizz.controller.js';
import { checkUser } from '../middlewares/checkUser.js';

export const quizzRouter = Router();

quizzRouter.get('/', getQuizzs);
quizzRouter.post('/', checkUser, createQuizz);
