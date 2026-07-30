import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { FindOptionsRelations } from "typeorm";
import { User } from "../entities/User.js";
import { JWT_SECRET } from "../config.js";
import "../types/express.js";

export async function verifyUserFromToken(
  token: string | undefined,
  relations: FindOptionsRelations<User> = {},
): Promise<User | null> {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await User.findOne({ where: { id: payload.userId }, relations });
    return user ?? null;
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | undefined {
  const token: unknown = req.cookies?.token;
  return typeof token === "string" ? token : undefined;
}

export async function checkUser(req: Request, res: Response, next: NextFunction) {
  const user = await verifyUserFromToken(extractToken(req));

  if (!user) {
    res.status(401).json({ errors: ["Not authenticated"] });
    return;
  }

  req.user = user;
  next();
}

export async function optionalUser(req: Request, res: Response, next: NextFunction) {
  req.user = (await verifyUserFromToken(extractToken(req))) ?? undefined;
  next();
}
