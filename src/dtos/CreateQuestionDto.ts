import { Type } from "class-transformer";
import { ArrayMinSize, IsBoolean, IsInt, IsNotEmpty, ValidateNested } from "class-validator";

export class CreateChoiceDto {
    @IsNotEmpty()
    text!: string;

    @IsBoolean()
    isCorrect!: boolean;
}

export class CreateQuestionDto {
    @IsNotEmpty()
    text!: string;

    @IsInt()
    @IsNotEmpty()
    categoryId!: number;

    @ValidateNested({ each: true })
    @Type(() => CreateChoiceDto)
    @ArrayMinSize(2)
    choices!: CreateChoiceDto[];
}
