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
import { User } from './User.js';

@Entity()
export class Quizz extends BaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    title!: string;

    @Column()
    description!: string;

    @Column({ default: "draft" })
    status: "draft" | "published" | "archived" = "draft";

    @ManyToOne(() => User)
    author!: User;

    @RelationId((quizz: Quizz) => quizz.author)
    authorId!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
