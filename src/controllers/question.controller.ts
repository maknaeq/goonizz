import { Request, Response } from 'express';
import { Question } from '../entities/Question.js';
import { CreateQuestionDto } from '../dtos/CreateQuestionDto.js';
import { findOwnedQuizz } from '../utils/quizz.js';
import { validateDto } from '../utils/validation.js';
import '../types/express.js';

export async function createQuestion(req: Request, res: Response) {
    const quizzId = Number(req.params.quizzId);
    const [quizz, { dto, errors }] = await Promise.all([
        findOwnedQuizz(quizzId, req.user!.id),
        validateDto(CreateQuestionDto, req.body),
    ]);

    if (!quizz) {
        res.status(404).json({ errors: ['Quizz not found'] });
        return;
    }

    if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
    }

    const question = await Question.create({
        text: dto.text,
        correctAnswer: dto.correctAnswer,
        quizz,
    }).save();

    res.status(201).json({
        id: question.id,
        text: question.text,
        correctAnswer: question.correctAnswer,
        order: question.order,
        quizzId: question.quizzId,
    });
}

export async function deleteQuestion(req: Request, res: Response) {
    const quizzId = Number(req.params.quizzId);
    const questionId = Number(req.params.questionId);

    const question = await Question.findOne({
        where: { id: questionId, quizz: { id: quizzId } },
        relations: { quizz: true },
    });

    if (!question || question.quizz.authorId !== req.user!.id) {
        res.status(404).json({ errors: ['Question not found'] });
        return;
    }

    await question.remove();

    res.status(204).send();
}
