import { Request, Response } from 'express';
import { Quizz } from '../entities/Quizz.js';
import { CreateQuizzDto } from '../dtos/CreateQuizzDto.js';
import { validateDto } from '../utils/validation.js';
import { omit } from '../utils/serialize.js';
import '../types/express.js';

function withoutAuthorPassword(quizz: Quizz) {
    const { author, ...rest } = quizz;
    return { ...rest, author: omit(author, 'password') };
}

export async function getQuizzs(req: Request, res: Response) {
    const quizzs = await Quizz.find({ relations: { author: true } });
    res.status(200).json(quizzs.map(withoutAuthorPassword));
}

export async function getQuizzById(req: Request, res: Response) {
    const quizz = await Quizz.findOne({
        where: { id: Number(req.params.id) },
        relations: { author: true, questions: { choices: true } },
    });

    if (!quizz) {
        res.status(404).json({ errors: ['Quizz not found'] });
        return;
    }

    const isOwner = req.user?.id === quizz.authorId;
    const { questions, ...rest } = withoutAuthorPassword(quizz);

    res.status(200).json({
        ...rest,
        questions: questions.map((question) => ({
            ...question,
            choices: question.choices.map((choice) => (isOwner ? choice : omit(choice, 'isCorrect'))),
        })),
    });
}

export async function createQuizz(req: Request, res: Response) {
    const { dto, errors } = await validateDto(CreateQuizzDto, req.body);

    if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
    }

    const quizz = Quizz.create({ ...dto, author: req.user! });
    await quizz.save();

    res.status(201).json(withoutAuthorPassword(quizz));
}
