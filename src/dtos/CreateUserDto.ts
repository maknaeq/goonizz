import { IsEmail, IsEnum, IsNotEmpty, IsOptional, MinLength } from "class-validator";
import { UserRole } from "../entities/User.js";

export class CreateUserDto {
    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsNotEmpty()
    @MinLength(8)
    password!: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;
}