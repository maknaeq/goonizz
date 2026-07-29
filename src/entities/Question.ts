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
import { Quizz } from './Quizz.js';
import type { Quizz as QuizzEntity } from './Quizz.js';
import { Category } from './Category.js';
import type { Category as CategoryEntity } from './Category.js';
import { Choice } from './Choice.js';
import type { Choice as ChoiceEntity } from './Choice.js';

@Entity()
export class Question extends BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    text!: string;

    @Column({ default: 0 })
    order: number = 0;

    @ManyToOne(() => Quizz, { onDelete: 'CASCADE' })
    quizz!: QuizzEntity;

    @RelationId((question: Question) => question.quizz)
    quizzId!: number;

    @ManyToOne(() => Category)
    category!: CategoryEntity;

    @RelationId((question: Question) => question.category)
    categoryId!: number;

    @OneToMany(() => Choice, (choice) => choice.question)
    choices!: ChoiceEntity[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
