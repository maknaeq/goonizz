import { Request, Response } from "express";
import { Category } from "../entities/Category.js";
import { CreateCategoryDto } from "../dtos/CreateCategoryDto.js";
import { validateDto } from "../utils/validation.js";
import "../types/express.js";

export async function getCategories(req: Request, res: Response) {
  const categories = await Category.find();
  res.status(200).json(categories);
}

export async function createCategory(req: Request, res: Response) {
  const { dto, errors } = await validateDto(CreateCategoryDto, req.body);

  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }

  const existing = await Category.createQueryBuilder("category")
    .where("category.name ILIKE :name", { name: dto.name })
    .getOne();

  if (existing) {
    res.status(400).json({ errors: ["Category already exists"] });
    return;
  }

  const category = Category.create({ name: dto.name });
  await category.save();

  res.status(201).json(category);
}
