import { IsEmail, IsNotEmpty } from "class-validator";

export class CreateTokenDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  password!: string;
}
