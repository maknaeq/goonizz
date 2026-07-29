import { Request, Response } from 'express';
import { Question } from '../entities/Question.js';
import { Choice } from '../entities/Choice.js';
import { Category } from '../entities/Category.js';
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

    if (!dto.choices.some((choice) => choice.isCorrect)) {
        res.status(400).json({ errors: ['at least one choice must be correct'] });
        return;
    }

    const category = await Category.findOne({ where: { id: dto.categoryId } });

    if (!category) {
        res.status(404).json({ errors: ['Category not found'] });
        return;
    }

    const question = await Question.create({ text: dto.text, quizz, category }).save();
    const savedChoices = await Choice.save(
        dto.choices.map((choice) => Choice.create({ text: choice.text, isCorrect: choice.isCorrect, question }))
    );

    res.status(201).json({
        id: question.id,
        text: question.text,
        order: question.order,
        quizzId: question.quizzId,
        categoryId: question.categoryId,
        choices: savedChoices.map(({ id, text, isCorrect }) => ({ id, text, isCorrect })),
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
