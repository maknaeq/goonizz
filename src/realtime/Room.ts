import type { WebSocket } from "ws";
import type { QuestionType } from "../entities/Question.js";

export type RoomQuestion = {
  id: number;
  text: string;
  type: QuestionType;
  correctAnswer: string;
  mediaId: number | null;
};

export type RoomState = "lobby" | "question" | "review" | "finished";

type Member = {
  email: string;
  score: number;
  currentAnswer: string | null;
  socket: WebSocket;
};

export type ScoreboardEntry = { email: string; score: number };

export type PendingAnswer = {
  playerId: number;
  email: string;
  questionText: string;
  correctAnswer: string;
  answerText: string;
};

export type AdvanceResult =
  | { kind: "question"; question: RoomQuestion }
  | { kind: "review"; answer: PendingAnswer; index: number; total: number }
  | { kind: "finished"; scoreboard: ScoreboardEntry[] };

export class Room {
  readonly code: string;
  readonly quizzId: number | null;
  readonly hostUserId: number;

  private readonly questions: RoomQuestion[];
  // Everyone connected to the room (host + joined players). The host is a member so it
  // receives broadcasts, but it's excluded from `playerEmails()`/`scoreboard()` — it doesn't play.
  private readonly members = new Map<number, Member>();
  // Every answer collected across the whole game, reviewed one by one by the host once
  // the last question has been played.
  private readonly answers: PendingAnswer[] = [];
  private reviewIndex = 0;
  private state: RoomState = "lobby";
  private currentQuestionIndex = 0;

  constructor(
    code: string,
    quizzId: number | null,
    hostUserId: number,
    hostEmail: string,
    questions: RoomQuestion[],
    hostSocket: WebSocket,
  ) {
    if (questions.length === 0) {
      throw new Error("Room requires at least one question");
    }

    this.code = code;
    this.quizzId = quizzId;
    this.hostUserId = hostUserId;
    this.questions = questions;
    this.members.set(hostUserId, {
      email: hostEmail,
      score: 0,
      currentAnswer: null,
      socket: hostSocket,
    });
  }

  isHost(userId: number): boolean {
    return userId === this.hostUserId;
  }

  isJoinable(): boolean {
    return this.state === "lobby";
  }

  isAcceptingAnswers(): boolean {
    return this.state === "question";
  }

  addPlayer(userId: number, email: string, socket: WebSocket): void {
    this.members.set(userId, { email, score: 0, currentAnswer: null, socket });
  }

  removePlayer(userId: number): void {
    this.members.delete(userId);
  }

  playerEmails(): string[] {
    return this.players().map(({ member }) => member.email);
  }

  currentQuestion(): RoomQuestion | null {
    return this.questions[this.currentQuestionIndex] ?? null;
  }

  start(): RoomQuestion {
    this.state = "question";
    this.currentQuestionIndex = 0;
    return this.questions[0]!;
  }

  submitAnswer(userId: number, text: string): boolean {
    const member = this.members.get(userId);

    if (!member || userId === this.hostUserId || member.currentAnswer !== null) {
      return false;
    }

    member.currentAnswer = text;
    return true;
  }

  // Called by the host to move past the current question. Collects everyone's raw answer
  // for later review, then either shows the next question or, once the last question has
  // been played, starts the review phase (no automatic scoring happens here).
  advance(): AdvanceResult {
    const question = this.currentQuestion();

    if (question) {
      for (const player of this.players()) {
        if (player.member.currentAnswer !== null) {
          this.answers.push({
            playerId: player.userId,
            email: player.member.email,
            questionText: question.text,
            correctAnswer: question.correctAnswer,
            answerText: player.member.currentAnswer,
          });
        }
        player.member.currentAnswer = null;
      }
    }

    this.currentQuestionIndex += 1;
    const nextQuestion = this.currentQuestion();

    if (nextQuestion) {
      this.state = "question";
      return { kind: "question", question: nextQuestion };
    }

    return this.startReview();
  }

  // Returns the next unreviewed answer for the host to validate/refuse, or finishes the
  // game once every answer has been decided.
  decideReview(valid: boolean): AdvanceResult {
    const answer = this.answers[this.reviewIndex];

    if (answer && valid) {
      const player = this.members.get(answer.playerId);
      if (player) player.score += 1;
    }

    this.reviewIndex += 1;
    return this.nextReviewStep();
  }

  scoreboard(): ScoreboardEntry[] {
    return this.players()
      .map(({ member }) => ({ email: member.email, score: member.score }))
      .sort((a, b) => b.score - a.score);
  }

  broadcast(type: string, payload: unknown): void {
    this.send(this.members.values(), type, payload);
  }

  sendToHost(type: string, payload: unknown): void {
    const host = this.members.get(this.hostUserId);
    if (host) this.send([host], type, payload);
  }

  private startReview(): AdvanceResult {
    this.reviewIndex = 0;
    return this.nextReviewStep();
  }

  private nextReviewStep(): AdvanceResult {
    const answer = this.answers[this.reviewIndex];

    if (!answer) {
      this.state = "finished";
      return { kind: "finished", scoreboard: this.scoreboard() };
    }

    this.state = "review";
    return { kind: "review", answer, index: this.reviewIndex, total: this.answers.length };
  }

  private send(sockets: Iterable<Member>, type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload });
    for (const member of sockets) {
      if (member.socket.readyState === member.socket.OPEN) {
        member.socket.send(message);
      }
    }
  }

  private players(): { userId: number; member: Member }[] {
    return Array.from(this.members.entries())
      .filter(([userId]) => userId !== this.hostUserId)
      .map(([userId, member]) => ({ userId, member }));
  }
}
