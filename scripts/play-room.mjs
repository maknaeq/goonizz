
//   room:create   { quizzId }        -> { code }     (host only, must own the quizz)
//   room:create-random { categoryIds, questionCount }
//                                     -> { code }     (host only, PUBLISHED quizzes, any author)
//   room:join     { code }           -> { ok }       (broadcasts room:players)
//   room:start    { code }           -> { ok }       (host only, broadcasts question:show)
//   answer:submit { code, text }     -> { ok }
//   room:next     { code }           -> { ok }       (host only; broadcasts the next question:show,
//                                                      or sends the host the first review:answer once
//                                                      every question has been played)
//   review:decide { code, valid }    -> { ok }       (host only; sends the next review:answer, or
//                                                      broadcasts room:finished once all answers are reviewed)

import { createInterface } from 'node:readline/promises';
import WebSocket from 'ws';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WS_URL = BASE_URL.replace(/^http/, 'ws');

function parseArgs(argv) {
  const [role, ...rest] = argv;
  const args = { role };
  for (let i = 0; i < rest.length; i += 2) {
    args[rest[i].replace(/^--/, '')] = rest[i + 1];
  }
  return args;
}

async function signIn(email, password) {
  const res = await fetch(`${BASE_URL}/users/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw new Error(`Sign in failed (${res.status}): ${await res.text()}`);
  }

  const setCookie = res.headers.get('set-cookie');
  const token = setCookie?.match(/token=([^;]+)/)?.[1];

  if (!token) {
    throw new Error('No token cookie returned by /users/tokens');
  }

  return token;
}

// Thin wrapper around a raw `ws` connection implementing the request/response and broadcast
// conventions of the server's protocol. This CLI only ever awaits one request at a time, so a
// single pending resolver (rather than a map of concurrent in-flight requests) is enough.
class RoomClient {
  #socket;
  #nextRequestId = 1;
  #pendingResolve = null;
  #listeners;

  constructor(token, listeners) {
    this.#listeners = listeners;
    this.#socket = new WebSocket(WS_URL, { headers: { cookie: `token=${token}` } });
    this.#socket.on('message', (raw) => this.#dispatch(JSON.parse(raw.toString())));
  }

  connected() {
    return new Promise((resolve, reject) => {
      this.#socket.once('open', resolve);
      this.#socket.once('error', reject);
    });
  }

  async request(type, payload) {
    const requestId = String(this.#nextRequestId++);
    const ack = new Promise((resolve) => {
      this.#pendingResolve = resolve;
    });
    this.#socket.send(JSON.stringify({ type, requestId, payload }));
    const { ok, payload: responsePayload, error } = await ack;
    if (!ok) throw new Error(error);
    return responsePayload;
  }

  close() {
    this.#socket.close();
  }

  #dispatch(message) {
    if (message.type === 'response') {
      this.#pendingResolve?.(message);
      this.#pendingResolve = null;
      return;
    }
    this.#listeners[message.type]?.(message.payload);
  }
}

function printQuestion(question) {
  console.log(`\n[${question.type}] ${question.text}`);
  if (question.mediaId) console.log(`  media: ${BASE_URL}/media/${question.mediaId}`);
}

function printScoreboard(title, scoreboard) {
  console.log(`\n${title}`);
  scoreboard.forEach((p, i) => console.log(`  ${i + 1}. ${p.email} — ${p.score} pt(s)`));
}

// Shared setup for both roles: sign in, connect, and wire the one broadcast that ends a
// session (room:finished) the same way for host and player alike.
async function connectAndRegisterCommonHandlers(email, password, extraListeners) {
  const token = await signIn(email, password);
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const client = new RoomClient(token, {
    'room:finished': ({ scoreboard }) => {
      printScoreboard('Final results', scoreboard);
      rl.close();
      client.close();
      process.exit(0);
    },
    ...extraListeners,
  });

  await client.connected();
  return { client, rl };
}

async function runHost({ email, password, quizz, categories, count }) {
  const { client, rl } = await connectAndRegisterCommonHandlers(email, password, {
    'room:players': (players) => console.log(`\nPlayers in room: ${players.join(', ') || '(none yet)'}`),
    'question:show': async (question) => {
      printQuestion(question);
      await rl.question('\nPress enter once everyone has answered...');
      await client.request('room:next', { code });
    },
    'review:answer': async ({ email: player, questionText, correctAnswer, answerText, index, total }) => {
      console.log(`\nReview ${index + 1}/${total} — ${player}`);
      console.log(`  question: ${questionText}`);
      console.log(`  expected: ${correctAnswer}`);
      console.log(`  answered: ${answerText}`);
      const valid = (await rl.question('Valid? (y/n): ')).trim().toLowerCase().startsWith('y');
      await client.request('review:decide', { code, valid });
    },
  });

  const { code } = categories
    ? await client.request('room:create-random', {
        categoryIds: categories.split(',').map(Number),
        questionCount: Number(count),
      })
    : await client.request('room:create', { quizzId: Number(quizz) });
  console.log(`Room created! Share this code with your friends: ${code}`);

  await rl.question('\nPress enter once everyone has joined to start the game...');
  await client.request('room:start', { code });
}

async function runPlayer({ email, password, code }) {
  const { client, rl } = await connectAndRegisterCommonHandlers(email, password, {
    'room:players': (players) => console.log(`\nPlayers in room: ${players.join(', ')}`),
    'question:show': async (question) => {
      printQuestion(question);
      const text = await rl.question('Your answer: ');

      try {
        await client.request('answer:submit', { code, text });
      } catch (err) {
        console.error('Could not submit answer:', err.message);
      }
    },
  });

  await client.request('room:join', { code });
  console.log(`Joined room ${code}. Waiting for the host to start...`);
}

const args = parseArgs(process.argv.slice(2));

if (args.role === 'host') {
  await runHost(args).catch((err) => {
    console.error('Could not create room:', err.message);
    process.exit(1);
  });
} else if (args.role === 'join') {
  await runPlayer(args).catch((err) => {
    console.error('Could not join room:', err.message);
    process.exit(1);
  });
} else {
  console.error('Usage:');
  console.error('  node scripts/play-room.mjs host --email <email> --password <password> --quizz <quizzId>');
  console.error('  node scripts/play-room.mjs host --email <email> --password <password> --categories <id1,id2> --count <n>');
  console.error('  node scripts/play-room.mjs join --email <email> --password <password> --code <roomCode>');
  process.exit(1);
}
