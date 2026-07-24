import 'reflect-metadata';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { datasource } from './datasource.js';
import { userRouter } from './routes/user.routes.js';
import { quizzRouter } from './routes/quizz.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { clearImageCache } from './utils/transformImage.js';
import { QuizSocketServer } from './realtime/QuizSocketServer.js';
import { PORT } from './config.js';

const CACHE_CLEAR_INTERVAL_MS = 30 * 60 * 1000;

async function main() {
    await datasource.initialize();

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/uploads', express.static('uploads'));

    app.get('/', (req, res) => {
        res.status(200).json({ message: 'Hello World!!!!'});
    })

    app.use('/users', userRouter);
    app.use('/quizzs', quizzRouter);
    app.use('/media', mediaRouter);

    app.use((req, res) => {
        res.status(404).json({ errors: ['Not Found!'] });
    })

    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.status(400).json({ errors: [err.message] });
    })

    const httpServer = http.createServer(app);
    new QuizSocketServer(httpServer);

    setInterval(() => {
        clearImageCache().catch((err) => console.error('Failed to clear image cache:', err));
    }, CACHE_CLEAR_INTERVAL_MS);

    httpServer.listen({ port: PORT, host: '0.0.0.0' }, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

main();