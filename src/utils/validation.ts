import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

export async function validateDto<T extends object>(
  dtoClass: new () => T,
  body: unknown,
): Promise<{ dto: T; errors: string[] }> {
  const dto = plainToInstance(dtoClass, body);
  const validationErrors = await validate(dto as object);
  const errors = validationErrors.flatMap((error) => Object.values(error.constraints ?? {}));
  return { dto, errors };
}
