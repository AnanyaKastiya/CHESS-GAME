const assert = require("assert");
const RoomManager = require("../src/sockets/RoomManager");
const { calculateElo } = require("../src/utils/elo");
const MatchmakingService = require("../src/services/matchmakingService");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

async function runAllTests() {
  console.log("\n🧪 Running Multiplayer Chess Backend Test Suite...\n");

  const mockIo = {
    to: () => ({ emit: () => {} }),
    sockets: { sockets: new Map() },
  };

  test("Room creation with default properties", () => {
    const rm = new RoomManager(mockIo);
    const room = rm.createRoom("test_room_1");
    assert.strictEqual(room.id, "test_room_1");
    assert.strictEqual(room.status, "waiting");
    assert.strictEqual(room.chess.turn(), "w");
  });

  test("Player role assignment (White, Black, Spectator)", () => {
    const rm = new RoomManager(mockIo);
    const s1 = { id: "s1", join: () => {} };
    const s2 = { id: "s2", join: () => {} };
    const s3 = { id: "s3", join: () => {} };

    const r1 = rm.joinRoom("test_room_2", s1, { id: "u1", username: "Alice" });
    assert.strictEqual(r1.role, "w");

    const r2 = rm.joinRoom("test_room_2", s2, { id: "u2", username: "Bob" });
    assert.strictEqual(r2.role, "b");

    const r3 = rm.joinRoom("test_room_2", s3, { id: "u3", username: "Charlie" });
    assert.strictEqual(r3.role, "spectator");
  });

  test("Server-authoritative move validation (Legal e4 move)", () => {
    const rm = new RoomManager(mockIo);
    const s1 = { id: "s1", join: () => {} };
    const s2 = { id: "s2", join: () => {} };

    rm.joinRoom("r_game", s1, { id: "u1", username: "Alice" });
    rm.joinRoom("r_game", s2, { id: "u2", username: "Bob" });

    const res = rm.makeMove("r_game", "s1", { from: "e2", to: "e4", promotion: "q" });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.move.san, "e4");
    assert.strictEqual(rm.getRoom("r_game").chess.turn(), "b");
  });

  test("Turn order enforcement (Black moving first rejected)", () => {
    const rm = new RoomManager(mockIo);
    const s1 = { id: "s1", join: () => {} };
    const s2 = { id: "s2", join: () => {} };

    rm.joinRoom("r_turn", s1, { id: "u1", username: "Alice" });
    rm.joinRoom("r_turn", s2, { id: "u2", username: "Bob" });

    const res = rm.makeMove("r_turn", "s2", { from: "e7", to: "e5" });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes("Not your turn"));
  });

  test("Illegal chess move rejection (Pawn jumping 3 squares)", () => {
    const rm = new RoomManager(mockIo);
    const s1 = { id: "s1", join: () => {} };
    const s2 = { id: "s2", join: () => {} };

    rm.joinRoom("r_illegal", s1, { id: "u1", username: "Alice" });
    rm.joinRoom("r_illegal", s2, { id: "u2", username: "Bob" });

    const res = rm.makeMove("r_illegal", "s1", { from: "e2", to: "e5" });
    assert.strictEqual(res.success, false);
  });

  test("FIDE ELO rating calculation accuracy", () => {
    const eloWin = calculateElo(1200, 1200, 1, 32);
    assert.strictEqual(eloWin.newRatingA, 1216);
    assert.strictEqual(eloWin.newRatingB, 1184);

    const eloDraw = calculateElo(1500, 1500, 0.5, 32);
    assert.strictEqual(eloDraw.newRatingA, 1500);
    assert.strictEqual(eloDraw.newRatingB, 1500);
  });

  test("Matchmaking Queue enqueues and dequeues accurately", () => {
    const rm = new RoomManager(mockIo);
    const mm = new MatchmakingService(mockIo, rm);
    const mockSocket = { id: "sock_queue_1", emit: () => {} };

    const joinRes = mm.addToQueue(mockSocket, { id: "user_1", username: "Player1", rating: 1300 });
    assert.strictEqual(joinRes.success, true);
    assert.strictEqual(mm.getQueueLength(), 1);

    const removeRes = mm.removeFromQueue("sock_queue_1");
    assert.strictEqual(removeRes, true);
    assert.strictEqual(mm.getQueueLength(), 0);
  });

  const app = require("../src/app");
  const request = require("supertest");

  const testUser = {
    username: `dev_${Date.now()}`,
    email: `dev_${Date.now()}@example.com`,
    password: "Password123!",
  };
  let token = "";

  await runAsyncTest("REST POST /api/auth/register creates user & returns JWT", async () => {
    const res = await request(app).post("/api/auth/register").send(testUser);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
    token = res.body.token;
  });

  await runAsyncTest("REST POST /api/auth/login authenticates user & returns JWT", async () => {
    const res = await request(app).post("/api/auth/login").send({
      emailOrUsername: testUser.username,
      password: testUser.password,
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
  });

  await runAsyncTest("REST GET /api/auth/me verifies protected route with JWT", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.username, testUser.username);
  });

  await runAsyncTest("REST GET /api/health returns healthy server status", async () => {
    const res = await request(app).get("/api/health");
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, "healthy");
  });

  console.log(`\n========================================`);
  console.log(`  Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAllTests();
