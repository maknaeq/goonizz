import type { FindOptionsRelations } from 'typeorm';
import { Quizz } from '../entities/Quizz.js';

export async function findOwnedQuizz(
    quizzId: number,
    userId: number,
    relations?: FindOptionsRelations<Quizz>
): Promise<Quizz | null> {
    const quizz = await Quizz.findOne({ where: { id: quizzId }, relations });
    if (!quizz || quizz.authorId !== userId) {
        return null;
    }
    return quizz;
}
