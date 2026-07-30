import {
  BaseEntity,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  RelationId,
} from "typeorm";
import { Quizz } from "./Quizz.js";
import type { Quizz as QuizzEntity } from "./Quizz.js";
import { Category } from "./Category.js";
import type { Category as CategoryEntity } from "./Category.js";
import { Media } from "./Media.js";

export enum QuestionType {
  CLASSIC = "classic",
  BLIND_TEST = "blind_test",
  QUOTE = "quote",
  VIDEO_CLIP = "video_clip",
  IMAGE = "image",
}

@Entity()
export class Question extends BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  text!: string;

  @Column()
  correctAnswer!: string;

  @Column({ type: "simple-enum", enum: QuestionType, default: QuestionType.CLASSIC })
  type: QuestionType = QuestionType.CLASSIC;

  @Column({ default: 0 })
  order: number = 0;

  @ManyToOne(() => Quizz, { onDelete: "CASCADE" })
  quizz!: QuizzEntity;

  @RelationId((question: Question) => question.quizz)
  quizzId!: number;

  @ManyToOne(() => Category)
  category!: CategoryEntity;

  @RelationId((question: Question) => question.category)
  categoryId!: number;

  @ManyToOne(() => Media, { nullable: true, onDelete: "SET NULL" })
  media?: Media | null;

  @RelationId((question: Question) => question.media)
  mediaId?: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
