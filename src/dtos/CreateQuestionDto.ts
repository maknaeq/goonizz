import { IsNotEmpty } from "class-validator";

export class CreateQuestionDto {
    @IsNotEmpty()
    text!: string;

    @IsNotEmpty()
    correctAnswer!: string;
}
