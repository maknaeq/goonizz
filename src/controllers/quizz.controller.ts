import { Request, Response } from 'express';
import { Quizz } from '../entities/Quizz.js';
import '../types/express.js';

function withoutAuthorPassword(quizz: Quizz) {
    const { author, ...rest } = quizz;
    const { password, ...authorWithoutPassword } = author;
    return { ...rest, author: authorWithoutPassword };
}

export async function getQuizzs(req: Request, res: Response) {
    const quizzs = await Quizz.find({ relations: { author: true } });
    res.status(200).json(quizzs.map(withoutAuthorPassword));
}

export async function createQuizz(req: Request, res: Response) {
    const { title, description, status } = req.body;

    if (!title || !description) {
        res.status(400).json({ errors: ['title and description are required'] });
        return;
    }

    const quizz = Quizz.create({ title, description, status, author: req.user! });
    await quizz.save();

    res.status(201).json(withoutAuthorPassword(quizz));
}
