const RoomManager = require("../src/sockets/RoomManager");
const { calculateElo } = require("../src/utils/elo");

describe("Chess Game Logic, Room Manager & Server Authority", () => {
  let roomManager;
  const mockIo = {
    to: () => ({
      emit: () => {},
    }),
  };

  beforeEach(() => {
    roomManager = new RoomManager(mockIo);
  });

  it("should create an isolated room with default initial state", () => {
    const room = roomManager.createRoom("test_room_1");
    expect(room).toBeDefined();
    expect(room.id).toBe("test_room_1");
    expect(room.status).toBe("waiting");
    expect(room.chess.turn()).toBe("w");
    expect(room.white).toBeNull();
    expect(room.black).toBeNull();
  });

  it("should assign roles correctly to joining players", () => {
    const mockSocket1 = { id: "sock_1", join: () => {} };
    const mockSocket2 = { id: "sock_2", join: () => {} };
    const mockSocket3 = { id: "sock_3", join: () => {} };

    const p1 = roomManager.joinRoom("test_room_2", mockSocket1, { id: "u1", username: "Alice" });
    expect(p1.role).toBe("w");

    const p2 = roomManager.joinRoom("test_room_2", mockSocket2, { id: "u2", username: "Bob" });
    expect(p2.role).toBe("b");

    const p3 = roomManager.joinRoom("test_room_2", mockSocket3, { id: "u3", username: "Charlie" });
    expect(p3.role).toBe("spectator");
  });

  it("should validate and execute legal moves by authorized player", () => {
    const mockSocket1 = { id: "sock_w", join: () => {} };
    const mockSocket2 = { id: "sock_b", join: () => {} };

    roomManager.joinRoom("test_game", mockSocket1, { id: "u_w", username: "WhitePlayer" });
    roomManager.joinRoom("test_game", mockSocket2, { id: "u_b", username: "BlackPlayer" });

    // Legal e2 -> e4 by White
    const moveResult1 = roomManager.makeMove("test_game", "sock_w", {
      from: "e2",
      to: "e4",
      promotion: "q",
    });

    expect(moveResult1.success).toBe(true);
    expect(moveResult1.move.san).toBe("e4");
    expect(roomManager.getRoom("test_game").chess.turn()).toBe("b");

    // Legal e7 -> e5 by Black
    const moveResult2 = roomManager.makeMove("test_game", "sock_b", {
      from: "e7",
      to: "e5",
      promotion: "q",
    });

    expect(moveResult2.success).toBe(true);
    expect(moveResult2.move.san).toBe("e5");
    expect(roomManager.getRoom("test_game").chess.turn()).toBe("w");
  });

  it("should reject moves played out of turn", () => {
    const mockSocket1 = { id: "sock_w", join: () => {} };
    const mockSocket2 = { id: "sock_b", join: () => {} };

    roomManager.joinRoom("turn_test", mockSocket1, { id: "u_w", username: "WhitePlayer" });
    roomManager.joinRoom("turn_test", mockSocket2, { id: "u_b", username: "BlackPlayer" });

    // Black attempts to move first
    const illegalMove = roomManager.makeMove("turn_test", "sock_b", {
      from: "e7",
      to: "e5",
    });

    expect(illegalMove.success).toBe(false);
    expect(illegalMove.error).toContain("Not your turn");
  });

  it("should reject illegal chess moves according to FIDE rules", () => {
    const mockSocket1 = { id: "sock_w", join: () => {} };
    const mockSocket2 = { id: "sock_b", join: () => {} };

    roomManager.joinRoom("rules_test", mockSocket1, { id: "u_w", username: "WhitePlayer" });
    roomManager.joinRoom("rules_test", mockSocket2, { id: "u_b", username: "BlackPlayer" });

    // Pawn attempting illegal 3-square jump
    const illegalJump = roomManager.makeMove("rules_test", "sock_w", {
      from: "e2",
      to: "e5",
    });

    expect(illegalJump.success).toBe(false);
  });

  it("should accurately calculate ELO rating changes", () => {
    // Player A (1200) beats Player B (1200)
    const result1 = calculateElo(1200, 1200, 1, 32);
    expect(result1.newRatingA).toBe(1216);
    expect(result1.newRatingB).toBe(1184);

    // Player A (1500) draws against Player B (1500)
    const result2 = calculateElo(1500, 1500, 0.5, 32);
    expect(result2.newRatingA).toBe(1500);
    expect(result2.newRatingB).toBe(1500);
  });
});
