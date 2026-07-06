import { DataSource } from "typeorm";

export const datasource: DataSource = new DataSource({
    type: "better-sqlite3",
    database : process.env.DB_PATH || "./data/db/database.sqlite",
    logging: true,
    synchronize: true,
    entities: [__dirname + "/entities/*.{ts,js}"],
});