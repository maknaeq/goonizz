import {
    BaseEntity,
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    RelationId,
    OneToMany
} from 'typeorm';
import { User } from './User.js';
import { Question } from './Question.js';
import type { Question as QuestionEntity } from './Question.js';

export enum QuizzStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    ARCHIVED = "archived",
}

@Entity()
export class Quizz extends BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    title!: string;

    @Column()
    description!: string;

    @Column({ type: "simple-enum", enum: QuizzStatus, default: QuizzStatus.DRAFT })
    status: QuizzStatus = QuizzStatus.DRAFT;

    @ManyToOne(() => User)
    author!: User;

    @RelationId((quizz: Quizz) => quizz.author)
    authorId!: number;

    @OneToMany(() => Question, (question) => question.quizz)
    questions!: QuestionEntity[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
