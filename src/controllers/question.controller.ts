import { Request, Response } from "express";
import { Question, QuestionType } from "../entities/Question.js";
import { Category } from "../entities/Category.js";
import { Media } from "../entities/Media.js";
import { CreateQuestionDto } from "../dtos/CreateQuestionDto.js";
import { findOwnedQuizz } from "../utils/quizz.js";
import { validateDto } from "../utils/validation.js";
import "../types/express.js";

const MEDIA_REQUIRED_TYPES: QuestionType[] = [
  QuestionType.BLIND_TEST,
  QuestionType.VIDEO_CLIP,
  QuestionType.IMAGE,
];

export async function createQuestion(req: Request, res: Response) {
  const quizzId = Number(req.params.quizzId);
  const [quizz, { dto, errors }] = await Promise.all([
    findOwnedQuizz(quizzId, req.user!.id),
    validateDto(CreateQuestionDto, req.body),
  ]);

  if (!quizz) {
    res.status(404).json({ errors: ["Quizz not found"] });
    return;
  }

  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }

  const category = await Category.findOne({ where: { id: dto.categoryId } });

  if (!category) {
    res.status(404).json({ errors: ["Category not found"] });
    return;
  }

  let media: Media | null = null;
  if (dto.mediaId) {
    media = await Media.findOne({ where: { id: dto.mediaId } });
    if (!media) {
      res.status(400).json({ errors: ["Media not found"] });
      return;
    }
  }

  if (!media && MEDIA_REQUIRED_TYPES.includes(dto.type)) {
    res.status(400).json({ errors: [`type ${dto.type} requires a media`] });
    return;
  }

  const question = await Question.create({
    text: dto.text,
    correctAnswer: dto.correctAnswer,
    type: dto.type,
    category,
    media,
    quizz,
  }).save();

  res.status(201).json({
    id: question.id,
    text: question.text,
    correctAnswer: question.correctAnswer,
    type: question.type,
    categoryId: question.categoryId,
    mediaId: question.mediaId ?? null,
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
    res.status(404).json({ errors: ["Question not found"] });
    return;
  }

  await question.remove();

  res.status(204).send();
}
