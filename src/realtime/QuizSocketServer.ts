import type { Server as HttpServer, IncomingMessage } from "node:http";
import { parse as parseCookies } from "cookie";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { verifyUserFromToken } from "../middlewares/checkUser.js";
import { User } from "../entities/User.js";
import { findOwnedQuizz } from "../utils/quizz.js";
import { Question } from "../entities/Question.js";
import { QuizzStatus } from "../entities/Quizz.js";
import { Room, RoomQuestion } from "./Room.js";

type Session = { userId: number; email: string; roomCode?: string };

type AuthenticatedRequest = IncomingMessage & { user?: User };

type ClientMessage = { type: string; requestId?: string; payload?: unknown };

function publicQuestion(question: RoomQuestion) {
  return { id: question.id, text: question.text, type: question.type, mediaId: question.mediaId };
}

function rawDataToString(raw: RawData): string {
  if (Buffer.isBuffer(raw)) return raw.toString();
  if (Array.isArray(raw)) return Buffer.concat(raw).toString();
  return Buffer.from(raw).toString();
}

export class QuizSocketServer {
  private readonly wss: WebSocketServer;
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new WeakMap<WebSocket, Session>();

  private static readonly CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  constructor(httpServer: HttpServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      verifyClient: (info, callback) => this.verifyClient(info, callback),
    });
    this.wss.on("connection", (socket, req) => this.handleConnection(socket, req));
  }

  private verifyClient(
    info: { req: IncomingMessage },
    callback: (verified: boolean, code?: number, message?: string) => void,
  ): void {
    const token = parseCookies(info.req.headers.cookie ?? "").token;
    verifyUserFromToken(token)
      .then((user) => {
        if (!user) {
          callback(false, 401, "Not authenticated");
          return;
        }
        (info.req as AuthenticatedRequest).user = user;
        callback(true);
      })
      .catch(() => callback(false, 500, "Authentication error"));
  }

  private handleConnection(socket: WebSocket, req: AuthenticatedRequest): void {
    const user = req.user!;
    this.sessions.set(socket, { userId: user.id, email: user.email });
    socket.on("message", (raw) => {
      void this.handleMessage(socket, rawDataToString(raw));
    });
    socket.on("close", () => this.handleClose(socket));
  }

  private async handleMessage(socket: WebSocket, raw: string): Promise<void> {
    const session = this.sessions.get(socket);
    if (!session) return;

    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    const { type, requestId, payload } = message;

    try {
      switch (type) {
        case "room:create":
          await this.handleRoomCreate(socket, session, requestId, payload as { quizzId: number });
          break;
        case "room:create-random":
          await this.handleRoomCreateRandom(
            socket,
            session,
            requestId,
            payload as { categoryIds: number[]; questionCount: number },
          );
          break;
        case "room:join":
          this.handleRoomJoin(socket, session, requestId, payload as { code: string });
          break;
        case "room:start":
          this.handleRoomStart(socket, session, requestId, payload as { code: string });
          break;
        case "answer:submit":
          this.handleAnswerSubmit(
            socket,
            session,
            requestId,
            payload as { code: string; text: string },
          );
          break;
        case "room:next":
          this.handleRoomNext(socket, session, requestId, payload as { code: string });
          break;
        case "review:decide":
          this.handleReviewDecide(
            socket,
            session,
            requestId,
            payload as { code: string; valid: boolean },
          );
          break;
        default:
          throw new Error("Unknown message type");
      }
    } catch (err) {
      this.sendResponse(
        socket,
        requestId,
        false,
        undefined,
        err instanceof Error ? err.message : "Unexpected error",
      );
    }
  }

  private async handleRoomCreate(
    socket: WebSocket,
    session: Session,
    requestId: string | undefined,
    payload: { quizzId: number },
  ): Promise<void> {
    const quizz = await findOwnedQuizz(payload.quizzId, session.userId, {
      questions: { media: true },
    });

    if (!quizz) {
      throw new Error("Quizz not found");
    }

    if (quizz.questions.length === 0) {
      throw new Error("Quizz has no questions");
    }

    this.createRoom(socket, session, requestId, quizz.id, quizz.questions);
  }

  private async handleRoomCreateRandom(
    socket: WebSocket,
    session: Session,
    requestId: string | undefined,
    payload: { categoryIds: number[]; questionCount: number },
  ): Promise<void> {
    const { categoryIds, questionCount } = payload;

    if (
      !Array.isArray(categoryIds) ||
      categoryIds.length === 0 ||
      categoryIds.some((id) => !Number.isInteger(id))
    ) {
      throw new Error("categoryIds must be a non-empty array of numbers");
    }

    if (!Number.isInteger(questionCount) || questionCount <= 0) {
      throw new Error("questionCount must be a positive integer");
    }

    const pool = await Question.createQueryBuilder("question")
      .innerJoin("question.quizz", "quizz")
      .where("quizz.status = :status", { status: QuizzStatus.PUBLISHED })
      .andWhere("question.categoryId IN (:...categoryIds)", { categoryIds })
      .getMany();

    if (pool.length < questionCount) {
      throw new Error("Not enough questions in selected categories");
    }

    const picked = this.pickRandom(pool, questionCount);

    this.createRoom(socket, session, requestId, null, picked);
  }

  private createRoom(
    socket: WebSocket,
    session: Session,
    requestId: string | undefined,
    quizzId: number | null,
    questions: Question[],
  ): void {
    const code = this.generateRoomCode();
    const room = new Room(
      code,
      quizzId,
      session.userId,
      session.email,
      questions.map((question) => ({
        id: question.id,
        text: question.text,
        type: question.type,
        correctAnswer: question.correctAnswer,
        mediaId: question.mediaId ?? null,
      })),
      socket,
    );

    this.rooms.set(code, room);
    session.roomCode = code;
    this.sendResponse(socket, requestId, true, { code });
  }

  private pickRandom<T>(items: T[], count: number): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled.slice(0, count);
  }

  private handleRoomJoin(
    socket: WebSocket,
    session: Session,
    requestId: string | undefined,
    payload: { code: string },
  ): void {
    const room = this.rooms.get(payload.code);

    if (!room || !room.isJoinable()) {
      throw new Error("Room not joinable");
    }

    room.addPlayer(session.userId, session.email, socket);
    session.roomCode = room.code;
    room.broadcast("room:players", room.playerEmails());
    this.sendResponse(socket, requestId, true, { ok: true });
  }

  private handleRoomStart(
    socket: WebSocket,
    session: Session,
    requestId: string | undefined,
    payload: { code: string },
  ): void {
    const room = this.requireHostRoom(session, payload.code);

    const question = room.start();
    room.broadcast("question:show", publicQuestion(question));
    this.sendResponse(socket, requestId, true, { ok: true });
  }

  private handleAnswerSubmit(
    socket: WebSocket,
    session: Session,
    requestId: string | undefined,
    payload: { code: string; text: string },
  ): void {
    const room = this.rooms.get(payload.code);

    if (!room || !room.isAcceptingAnswers() || !room.submitAnswer(session.userId, payload.text)) {
      throw new Error("Not accepting answers");
    }

    this.sendResponse(socket, requestId, true, { ok: true });
  }

  private handleRoomNext(
    socket: WebSocket,
    session: Session,
    requestId: string | undefined,
    payload: { code: string },
  ): void {
    const room = this.requireHostRoom(session, payload.code);
    this.dispatchAdvance(room, room.advance());
    this.sendResponse(socket, requestId, true, { ok: true });
  }

  private handleReviewDecide(
    socket: WebSocket,
    session: Session,
    requestId: string | undefined,
    payload: { code: string; valid: boolean },
  ): void {
    const room = this.requireHostRoom(session, payload.code);
    this.dispatchAdvance(room, room.decideReview(payload.valid));
    this.sendResponse(socket, requestId, true, { ok: true });
  }

  // A question can lead straight into the review phase once it's the last one, and a
  // review decision can either surface the next answer or end the game — both `Room`
  // transitions funnel through the same three outcomes, so handle them in one place.
  private dispatchAdvance(room: Room, result: ReturnType<Room["advance"]>): void {
    if (result.kind === "question") {
      room.broadcast("question:show", publicQuestion(result.question));
    } else if (result.kind === "review") {
      room.sendToHost("review:answer", {
        email: result.answer.email,
        questionText: result.answer.questionText,
        correctAnswer: result.answer.correctAnswer,
        answerText: result.answer.answerText,
        index: result.index,
        total: result.total,
      });
    } else {
      room.broadcast("room:finished", { scoreboard: result.scoreboard });
      this.rooms.delete(room.code);
    }
  }

  private handleClose(socket: WebSocket): void {
    const session = this.sessions.get(socket);
    if (!session?.roomCode) return;

    const room = this.rooms.get(session.roomCode);
    if (!room) return;

    if (room.isHost(session.userId)) {
      room.broadcast("room:finished", { scoreboard: room.scoreboard(), reason: "host_left" });
      this.rooms.delete(room.code);
    } else {
      room.removePlayer(session.userId);
      room.broadcast("room:players", room.playerEmails());
    }
  }

  private requireHostRoom(session: Session, code: string): Room {
    const room = this.rooms.get(code);

    if (!room || !room.isHost(session.userId)) {
      throw new Error("Not allowed");
    }

    return room;
  }

  private sendResponse(
    socket: WebSocket,
    requestId: string | undefined,
    ok: boolean,
    payload?: unknown,
    error?: string,
  ): void {
    socket.send(JSON.stringify({ type: "response", requestId, ok, payload, error }));
  }

  private generateRoomCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: 6 },
        () =>
          QuizSocketServer.CODE_CHARS[
            Math.floor(Math.random() * QuizSocketServer.CODE_CHARS.length)
          ],
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }
}
