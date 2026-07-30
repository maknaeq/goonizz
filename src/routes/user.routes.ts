import { Router } from "express";
import {
  getUsers,
  createUser,
  createToken,
  deleteToken,
  getPublic,
  getPrivate,
  uploadAvatar,
} from "../controllers/user.controller.js";
import { checkUser } from "../middlewares/checkUser.js";
import { upload } from "../middlewares/upload.js";

export const userRouter = Router();

userRouter.get("/", getUsers);
userRouter.post("/", createUser);
userRouter.post("/tokens", createToken);
userRouter.delete("/tokens", deleteToken);
userRouter.get("/public", getPublic);
userRouter.get("/private", checkUser, getPrivate);
userRouter.post("/avatar", checkUser, upload.single("avatar"), uploadAvatar);
