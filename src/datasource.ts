import { DataSource } from "typeorm";

export const datasource: DataSource = new DataSource({
    type: "postgres",
    database : "postgres",
    username : "postgres",
    password : "secret",
    host: "db",
    logging: true,
    synchronize: true,
    entities: [import.meta.dirname + "/entities/*.{ts,js}"],
});