import {
    BaseEntity,
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    RelationId
} from 'typeorm';
import { Question } from './Question.js';
import type { Question as QuestionEntity } from './Question.js';

@Entity()
export class Choice extends BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    text!: string;

    @Column({ default: false })
    isCorrect: boolean = false;

    @ManyToOne(() => Question, { onDelete: 'CASCADE' })
    question!: QuestionEntity;

    @RelationId((choice: Choice) => choice.question)
    questionId!: number;
}
