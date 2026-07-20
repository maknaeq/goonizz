import { IsIn, IsNotEmpty, IsOptional } from "class-validator";

export class CreateQuizzDto {
    @IsNotEmpty()
    title!: string;

    @IsNotEmpty()
    description!: string;

    @IsOptional()
    @IsIn(["draft", "published", "archived"])
    status?: "draft" | "published" | "archived";
}
