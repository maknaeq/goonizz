import { Router } from "express";
import { getQuizzs, getQuizzById, createQuizz } from "../controllers/quizz.controller.js";
import { checkUser, optionalUser } from "../middlewares/checkUser.js";
import { questionRouter } from "./question.routes.js";

export const quizzRouter = Router();

quizzRouter.get("/", getQuizzs);
quizzRouter.post("/", checkUser, createQuizz);
quizzRouter.get("/:id", optionalUser, getQuizzById);
quizzRouter.use("/:quizzId/questions", questionRouter);
