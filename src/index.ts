import 'reflect-metadata';
import http from 'http';
import express from 'express';
import { AppDataSource } from './datasource';
import { User } from './entities/User';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Hello world' }));

app.post('/users', async (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  const user = AppDataSource.getRepository(User).create({ first_name, last_name, email, password });
  const result = await AppDataSource.getRepository(User).save(user);
  res.status(201).json(result);
});

AppDataSource.initialize().then(() => {
  http.createServer(app).listen(PORT, () => console.log(`Server running on port ${PORT}`));
});