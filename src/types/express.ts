import { User } from "../entities/User.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- required by Express's own type augmentation pattern
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
