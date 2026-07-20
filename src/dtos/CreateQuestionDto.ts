import { Type } from "class-transformer";
import { ArrayMinSize, IsBoolean, IsNotEmpty, ValidateNested } from "class-validator";

export class CreateChoiceDto {
    @IsNotEmpty()
    text!: string;

    @IsBoolean()
    isCorrect!: boolean;
}

export class CreateQuestionDto {
    @IsNotEmpty()
    text!: string;

    @ValidateNested({ each: true })
    @Type(() => CreateChoiceDto)
    @ArrayMinSize(2)
    choices!: CreateChoiceDto[];
}
