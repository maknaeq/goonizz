import { Router } from "express";
import { createQuestion, deleteQuestion } from "../controllers/question.controller.js";
import { checkUser } from "../middlewares/checkUser.js";

export const questionRouter = Router({ mergeParams: true });

questionRouter.post("/", checkUser, createQuestion);
questionRouter.delete("/:questionId", checkUser, deleteQuestion);
