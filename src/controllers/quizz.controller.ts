import { Request, Response } from 'express';
import { Quizz } from '../entities/Quizz.js';

export async function getQuizzs(req: Request, res: Response) {
    const quizzs = await Quizz.find();
    res.status(200).json(quizzs);
}

export async function createQuizz(req: Request, res: Response) {
    const { title, description, status } = req.body;

    if (!title || !description) {
        res.status(400).json({ errors: ['title and description are required'] });
        return;
    }

    const quizz = Quizz.create({ title, description, status });
    await quizz.save();

    res.status(201).json(quizz);
}
