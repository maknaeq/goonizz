import { Router } from "express";
import { getCategories, createCategory } from "../controllers/category.controller.js";
import { checkUser } from "../middlewares/checkUser.js";

export const categoryRouter = Router();

categoryRouter.get("/", getCategories);
categoryRouter.post("/", checkUser, createCategory);
