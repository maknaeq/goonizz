import {
    BaseEntity,
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    RelationId
} from 'typeorm';
import { Quizz } from './Quizz.js';
import type { Quizz as QuizzEntity } from './Quizz.js';

@Entity()
export class Question extends BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    text!: string;

    @Column()
    correctAnswer!: string;

    @Column({ default: 0 })
    order: number = 0;

    @ManyToOne(() => Quizz, { onDelete: 'CASCADE' })
    quizz!: QuizzEntity;

    @RelationId((question: Question) => question.quizz)
    quizzId!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
