import 'reflect-metadata';
import express from 'express';
import cookieParser from 'cookie-parser';
import { datasource } from './datasource.js';
import { userRouter } from './routes/user.routes.js';
import { quizzRouter } from './routes/quizz.routes.js';

const port = process.env.PORT || 3300;

async function main() {
    await datasource.initialize();

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/uploads', express.static('uploads'));

    app.get('/', (req, res) => {
        res.status(200).json({ message: 'Hello World!'});
    })

    app.use('/users', userRouter);
    app.use('/quizzs', quizzRouter);

    app.use((req, res) => {
        res.status(404).json({ errors: ['Not Found!'] });
    })

    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.status(400).json({ errors: [err.message] });
    })

    app.listen({ port, host: '0.0.0.0' }, () => {
        console.log(`Server is running on port ${port}`);
    });
}

main();