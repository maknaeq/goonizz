import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { parse as parseCookies } from 'cookie';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyUserFromToken } from '../middlewares/checkUser.js';
import { User } from '../entities/User.js';
import { findOwnedQuizz } from '../utils/quizz.js';
import { Room, RoomQuestion } from './Room.js';

type Session = { userId: number; email: string; roomCode?: string };

type AuthenticatedRequest = IncomingMessage & { user?: User };

type ClientMessage = { type: string; requestId?: string; payload?: unknown };

function publicQuestion(question: RoomQuestion) {
    return { id: question.id, text: question.text, choices: question.choices.map(({ id, text }) => ({ id, text })) };
}

export class QuizSocketServer {
    private readonly wss: WebSocketServer;
    private readonly rooms = new Map<string, Room>();
    private readonly sessions = new WeakMap<WebSocket, Session>();

    private static readonly CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    constructor(httpServer: HttpServer) {
        this.wss = new WebSocketServer({
            server: httpServer,
            verifyClient: (info, callback) => this.verifyClient(info, callback),
        });
        this.wss.on('connection', (socket, req) => this.handleConnection(socket, req as AuthenticatedRequest));
    }

    // Runs before the WebSocket handshake completes, so by the time 'connection' fires the
    // session is already known — no async gap during which an early client message could be
    // dropped (ws does not buffer messages received before a 'message' listener is attached).
    private verifyClient(
        info: { req: IncomingMessage },
        callback: (verified: boolean, code?: number, message?: string) => void
    ): void {
        const token = parseCookies(info.req.headers.cookie ?? '').token;
        verifyUserFromToken(token, {}).then((user) => {
            if (!user) {
                callback(false, 401, 'Not authenticated');
                return;
            }
            (info.req as AuthenticatedRequest).user = user;
            callback(true);
        });
    }

    private handleConnection(socket: WebSocket, req: AuthenticatedRequest): void {
        const user = req.user!;
        this.sessions.set(socket, { userId: user.id, email: user.email });
        socket.on('message', (raw) => this.handleMessage(socket, raw.toString()));
        socket.on('close', () => this.handleClose(socket));
    }

    private async handleMessage(socket: WebSocket, raw: string): Promise<void> {
        const session = this.sessions.get(socket);
        if (!session) return;

        let message: ClientMessage;
        try {
            message = JSON.parse(raw);
        } catch {
            return;
        }

        const { type, requestId, payload } = message;

        try {
            switch (type) {
                case 'room:create':
                    await this.handleRoomCreate(socket, session, requestId, payload as { quizzId: number });
                    break;
                case 'room:join':
                    this.handleRoomJoin(socket, session, requestId, payload as { code: string });
                    break;
                case 'room:start':
                    this.handleRoomStart(socket, session, requestId, payload as { code: string });
                    break;
                case 'answer:submit':
                    this.handleAnswerSubmit(socket, session, requestId, payload as { code: string; choiceIds: number[] });
                    break;
                case 'room:next':
                    this.handleRoomNext(socket, session, requestId, payload as { code: string });
                    break;
                default:
                    throw new Error('Unknown message type');
            }
        } catch (err) {
            this.sendResponse(socket, requestId, false, undefined, err instanceof Error ? err.message : 'Unexpected error');
        }
    }

    private async handleRoomCreate(
        socket: WebSocket,
        session: Session,
        requestId: string | undefined,
        payload: { quizzId: number }
    ): Promise<void> {
        const quizz = await findOwnedQuizz(payload.quizzId, session.userId, { questions: { choices: true } });

        if (!quizz) {
            throw new Error('Quizz not found');
        }

        if (quizz.questions.length === 0) {
            throw new Error('Quizz has no questions');
        }

        const code = this.generateRoomCode();
        const room = new Room(
            code,
            quizz.id,
            session.userId,
            session.email,
            quizz.questions.map((question) => ({
                id: question.id,
                text: question.text,
                choices: question.choices.map((choice) => ({
                    id: choice.id,
                    text: choice.text,
                    isCorrect: choice.isCorrect,
                })),
            })),
            socket
        );

        this.rooms.set(code, room);
        session.roomCode = code;
        this.sendResponse(socket, requestId, true, { code });
    }

    private handleRoomJoin(socket: WebSocket, session: Session, requestId: string | undefined, payload: { code: string }): void {
        const room = this.rooms.get(payload.code);

        if (!room || !room.isJoinable()) {
            throw new Error('Room not joinable');
        }

        room.addPlayer(session.userId, session.email, socket);
        session.roomCode = room.code;
        room.broadcast('room:players', room.playerEmails());
        this.sendResponse(socket, requestId, true, { ok: true });
    }

    private handleRoomStart(socket: WebSocket, session: Session, requestId: string | undefined, payload: { code: string }): void {
        const room = this.requireHostRoom(session, payload.code);

        const question = room.start();
        room.broadcast('question:show', publicQuestion(question!));
        this.sendResponse(socket, requestId, true, { ok: true });
    }

    private handleAnswerSubmit(
        socket: WebSocket,
        session: Session,
        requestId: string | undefined,
        payload: { code: string; choiceIds: number[] }
    ): void {
        const room = this.rooms.get(payload.code);

        if (!room || !room.isAcceptingAnswers() || !room.submitAnswer(session.userId, payload.choiceIds)) {
            throw new Error('Not accepting answers');
        }

        this.sendResponse(socket, requestId, true, { ok: true });
    }

    private handleRoomNext(socket: WebSocket, session: Session, requestId: string | undefined, payload: { code: string }): void {
        const room = this.requireHostRoom(session, payload.code);

        const { correctChoiceIds, scoreboard, nextQuestion } = room.revealAndAdvance();
        room.broadcast('question:reveal', { correctChoiceIds, scoreboard });

        if (nextQuestion) {
            room.broadcast('question:show', publicQuestion(nextQuestion));
        } else {
            room.broadcast('room:finished', { scoreboard });
            this.rooms.delete(room.code);
        }

        this.sendResponse(socket, requestId, true, { ok: true });
    }

    private handleClose(socket: WebSocket): void {
        const session = this.sessions.get(socket);
        if (!session?.roomCode) return;

        const room = this.rooms.get(session.roomCode);
        if (!room) return;

        if (room.isHost(session.userId)) {
            room.broadcast('room:finished', { scoreboard: room.scoreboard(), reason: 'host_left' });
            this.rooms.delete(room.code);
        } else {
            room.removePlayer(session.userId);
            room.broadcast('room:players', room.playerEmails());
        }
    }

    private requireHostRoom(session: Session, code: string): Room {
        const room = this.rooms.get(code);

        if (!room || !room.isHost(session.userId)) {
            throw new Error('Not allowed');
        }

        return room;
    }

    private sendResponse(socket: WebSocket, requestId: string | undefined, ok: boolean, payload?: unknown, error?: string): void {
        socket.send(JSON.stringify({ type: 'response', requestId, ok, payload, error }));
    }

    private generateRoomCode(): string {
        let code: string;
        do {
            code = Array.from({ length: 6 }, () => QuizSocketServer.CODE_CHARS[Math.floor(Math.random() * QuizSocketServer.CODE_CHARS.length)]).join('');
        } while (this.rooms.has(code));
        return code;
    }
}
