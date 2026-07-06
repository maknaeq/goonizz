import 'reflect-metadata';
import express from 'express';
import { datasource } from './datasource.js';
import { userRouter } from './routes/user.routes.js';

const port = process.env.PORT || 3300;

async function main() {
    await datasource.initialize();

    const app = express();
    app.use(express.json());

    app.get('/', (req, res) => {
        res.status(200).json({ message: 'Hello World!'});
    })

    app.use('/users', userRouter);

    app.use((req, res) => {
        res.status(404).json({ errors: ['Not Found!'] });
    })

    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

main();