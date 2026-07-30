import { DataSource } from "typeorm";
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_USER } from "./config.js";

export const datasource: DataSource = new DataSource({
  type: "postgres",
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  logging: process.env.NODE_ENV !== "production",
  synchronize: true,
  entities: [import.meta.dirname + "/entities/*.{ts,js}"],
});
