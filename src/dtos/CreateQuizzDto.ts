import { IsEnum, IsNotEmpty, IsOptional } from "class-validator";
import { QuizzStatus } from "../entities/Quizz.js";

export class CreateQuizzDto {
    @IsNotEmpty()
    title!: string;

    @IsNotEmpty()
    description!: string;

    @IsOptional()
    @IsEnum(QuizzStatus)
    status?: QuizzStatus;
}
