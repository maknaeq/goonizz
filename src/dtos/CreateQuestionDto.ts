import { IsEnum, IsInt, IsNotEmpty, IsOptional } from "class-validator";
import { QuestionType } from "../entities/Question.js";

export class CreateQuestionDto {
  @IsNotEmpty()
  text!: string;

  @IsNotEmpty()
  correctAnswer!: string;

  @IsInt()
  @IsNotEmpty()
  categoryId!: number;

  @IsOptional()
  @IsEnum(QuestionType)
  type: QuestionType = QuestionType.CLASSIC;

  @IsOptional()
  @IsInt()
  mediaId?: number;
}
