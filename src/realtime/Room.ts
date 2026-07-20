import type { WebSocket } from 'ws';

export type RoomChoice = {
    id: number;
    text: string;
    isCorrect: boolean;
};

export type RoomQuestion = {
    id: number;
    text: string;
    choices: RoomChoice[];
};

export type RoomState = 'lobby' | 'question' | 'finished';

type Member = {
    email: string;
    isHost: boolean;
    score: number;
    answeredChoiceIds: number[] | null;
    socket: WebSocket;
};

export type ScoreboardEntry = { email: string; score: number };

export type RevealResult = {
    correctChoiceIds: number[];
    scoreboard: ScoreboardEntry[];
    nextQuestion: RoomQuestion | null;
};

export class Room {
    readonly code: string;
    readonly quizzId: number;
    readonly hostUserId: number;

    private readonly questions: RoomQuestion[];
    // Everyone connected to the room (host + joined players). The host is a member so it
    // receives broadcasts, but it's excluded from `playerEmails()`/`scoreboard()` — it doesn't play.
    private readonly members = new Map<number, Member>();
    private state: RoomState = 'lobby';
    private currentQuestionIndex = 0;

    constructor(
        code: string,
        quizzId: number,
        hostUserId: number,
        hostEmail: string,
        questions: RoomQuestion[],
        hostSocket: WebSocket
    ) {
        this.code = code;
        this.quizzId = quizzId;
        this.hostUserId = hostUserId;
        this.questions = questions;
        this.members.set(hostUserId, { email: hostEmail, isHost: true, score: 0, answeredChoiceIds: null, socket: hostSocket });
    }

    isHost(userId: number): boolean {
        return userId === this.hostUserId;
    }

    isJoinable(): boolean {
        return this.state === 'lobby';
    }

    isAcceptingAnswers(): boolean {
        return this.state === 'question';
    }

    addPlayer(userId: number, email: string, socket: WebSocket): void {
        this.members.set(userId, { email, isHost: false, score: 0, answeredChoiceIds: null, socket });
    }

    removePlayer(userId: number): void {
        this.members.delete(userId);
    }

    playerEmails(): string[] {
        return this.players().map((player) => player.email);
    }

    currentQuestion(): RoomQuestion | null {
        return this.questions[this.currentQuestionIndex] ?? null;
    }

    start(): RoomQuestion | null {
        this.state = 'question';
        this.currentQuestionIndex = 0;
        return this.currentQuestion();
    }

    submitAnswer(userId: number, choiceIds: number[]): boolean {
        const member = this.members.get(userId);

        if (!member || member.isHost || member.answeredChoiceIds !== null) {
            return false;
        }

        member.answeredChoiceIds = choiceIds;
        return true;
    }

    revealAndAdvance(): RevealResult {
        const question = this.currentQuestion();
        const correctChoiceIds = question ? question.choices.filter((c) => c.isCorrect).map((c) => c.id) : [];
        const correctSet = new Set(correctChoiceIds);

        for (const player of this.players()) {
            if (player.answeredChoiceIds && this.isAllCorrect(correctSet, player.answeredChoiceIds)) {
                player.score += 1;
            }
            player.answeredChoiceIds = null;
        }

        this.currentQuestionIndex += 1;
        const nextQuestion = this.currentQuestion();
        this.state = nextQuestion ? 'question' : 'finished';

        return { correctChoiceIds, scoreboard: this.scoreboard(), nextQuestion };
    }

    scoreboard(): ScoreboardEntry[] {
        return this.players()
            .map((player) => ({ email: player.email, score: player.score }))
            .sort((a, b) => b.score - a.score);
    }

    broadcast(type: string, payload: unknown): void {
        const message = JSON.stringify({ type, payload });
        for (const member of this.members.values()) {
            if (member.socket.readyState === member.socket.OPEN) {
                member.socket.send(message);
            }
        }
    }

    private players(): Member[] {
        return Array.from(this.members.values()).filter((member) => !member.isHost);
    }

    private isAllCorrect(correctChoiceIds: Set<number>, answeredChoiceIds: number[]): boolean {
        if (correctChoiceIds.size !== answeredChoiceIds.length) {
            return false;
        }
        return answeredChoiceIds.every((id) => correctChoiceIds.has(id));
    }
}
