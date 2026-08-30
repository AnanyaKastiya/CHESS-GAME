// Client-side Chess Game Logic & Real-Time Sync
const socket = io({
  auth: {
    token: localStorage.getItem("token") || null,
  },
});

const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

// State Variables
let currentRoomId = getInitialRoomId();
let playerRole = null; // 'w' | 'b' | 'spectator'
let selectedSquare = null;
let pendingPromotionMove = null;
let currentGameState = null;
let clockInterval = null;
let currentUser = null;

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkAuthStatus();
  fetchLeaderboard();
  joinCurrentRoom();
  renderBoard();
});

function getInitialRoomId() {
  const pathParts = window.location.pathname.split("/");
  if (pathParts[1] === "game" && pathParts[2]) {
    return pathParts[2];
  }
  return "main_lobby";
}

function joinCurrentRoom() {
  document.getElementById("currentRoomLabel").innerText = `Room: ${currentRoomId}`;
  socket.emit("joinRoom", { roomId: currentRoomId, user: currentUser });
}

// -------------------------------------------------------------
// Board Rendering & Move Interaction
// -------------------------------------------------------------
function renderBoard() {
  const board = chess.board();
  boardElement.innerHTML = "";

  // Highlight check
  let checkSquare = null;
  if (chess.in_check()) {
    const turn = chess.turn();
    board.forEach((row, r) => {
      row.forEach((sq, c) => {
        if (sq && sq.type === "k" && sq.color === turn) {
          checkSquare = { r, c };
        }
      });
    });
  }

  board.forEach((row, rowIndex) => {
    row.forEach((square, colIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowIndex + colIndex) % 2 === 0 ? "light" : "dark"
      );

      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = colIndex;
      const algebraicPos = getAlgebraic(rowIndex, colIndex);
      squareElement.dataset.pos = algebraicPos;

      // Check highlight
      if (checkSquare && checkSquare.r === rowIndex && checkSquare.c === colIndex) {
        squareElement.classList.add("in-check");
      }

      // Selected square indicator
      if (selectedSquare && selectedSquare.row === rowIndex && selectedSquare.col === colIndex) {
        squareElement.classList.add("highlight-last");
      }

      // Render Piece
      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(square);

        const isMovable = playerRole === square.color && chess.turn() === playerRole;
        pieceElement.draggable = isMovable;
        if (isMovable) pieceElement.classList.add("draggable");

        // Drag events
        pieceElement.addEventListener("dragstart", (e) => {
          if (!isMovable) return e.preventDefault();
          selectedSquare = { row: rowIndex, col: colIndex };
          e.dataTransfer.setData("text/plain", "");
          highlightLegalMoves(algebraicPos);
        });

        squareElement.appendChild(pieceElement);
      }

      // Click to Move Support
      squareElement.addEventListener("click", () => {
        handleSquareClick(rowIndex, colIndex, algebraicPos);
      });

      // Drop handlers
      squareElement.addEventListener("dragover", (e) => e.preventDefault());
      squareElement.addEventListener("drop", (e) => {
        e.preventDefault();
        if (selectedSquare) {
          attemptMove(selectedSquare, { row: rowIndex, col: colIndex });
        }
      });

      boardElement.appendChild(squareElement);
    });
  });

  // Flip board for Black player
  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }
}

function handleSquareClick(row, col, algebraicPos) {
  if (playerRole !== chess.turn()) return;

  const clickedPiece = chess.get(algebraicPos);

  if (selectedSquare) {
    // If clicking own other piece, change selection
    if (clickedPiece && clickedPiece.color === playerRole) {
      selectedSquare = { row, col };
      renderBoard();
      highlightLegalMoves(algebraicPos);
      return;
    }

    // Attempt Move
    attemptMove(selectedSquare, { row, col });
    selectedSquare = null;
    clearHighlights();
  } else if (clickedPiece && clickedPiece.color === playerRole) {
    selectedSquare = { row, col };
    renderBoard();
    highlightLegalMoves(algebraicPos);
  }
}

function highlightLegalMoves(fromSquare) {
  clearHighlights();
  const legalMoves = chess.moves({ square: fromSquare, verbose: true });
  legalMoves.forEach((m) => {
    const targetElement = document.querySelector(`[data-pos="${m.to}"]`);
    if (targetElement) {
      targetElement.classList.add("legal-hint");
    }
  });
}

function clearHighlights() {
  document.querySelectorAll(".legal-hint").forEach((el) => el.classList.remove("legal-hint"));
}

function attemptMove(source, target) {
  const from = getAlgebraic(source.row, source.col);
  const to = getAlgebraic(target.row, target.col);

  // Check if move is a pawn promotion
  const piece = chess.get(from);
  const isPromotion =
    piece &&
    piece.type === "p" &&
    ((piece.color === "w" && target.row === 0) || (piece.color === "b" && target.row === 7));

  if (isPromotion) {
    pendingPromotionMove = { from, to };
    document.getElementById("promotionModal").classList.remove("hidden");
    return;
  }

  sendMove({ from, to, promotion: "q" });
}

function sendMove(move) {
  socket.emit("move", { roomId: currentRoomId, move });
}

function getAlgebraic(row, col) {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

function getPieceUnicode(piece) {
  const unicodeMap = {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚",
  };
  return unicodeMap[piece.type] || "";
}

// -------------------------------------------------------------
// Real-Time Socket.IO Listeners
// -------------------------------------------------------------
socket.on("connect", () => {
  document.getElementById("connectionText").innerText = "Connected";
  document.getElementById("connectionBadge").querySelector("span").className = "w-2 h-2 rounded-full bg-emerald-500";
});

socket.on("disconnect", () => {
  document.getElementById("connectionText").innerText = "Disconnected";
  document.getElementById("connectionBadge").querySelector("span").className = "w-2 h-2 rounded-full bg-red-500 animate-ping";
});

socket.on("playerRole", ({ role, roomId }) => {
  playerRole = role;
  currentRoomId = roomId;
  document.getElementById("currentRoomLabel").innerText = `Room: ${roomId}`;
  renderBoard();
});

socket.on("roomState", (state) => {
  currentGameState = state;
  chess.load(state.fen);

  // Update Players & Connection Status
  updatePlayerHeader(state);

  // Update Move History
  updateMoveHistory(state.moves);

  // Update Timers
  syncTimers(state.timers, state.turn, state.status);

  // Check Game Over
  if (state.status === "completed" || state.gameOver) {
    showGameOverBanner(state.winner, state.winReason);
  } else {
    document.getElementById("gameStatusBanner").classList.add("hidden");
  }

  renderBoard();
});

socket.on("matchFound", ({ roomId, role, opponent }) => {
  currentRoomId = roomId;
  playerRole = role;
  document.getElementById("queueStatus").classList.add("hidden");
  document.getElementById("findMatchBtn").classList.remove("hidden");
  document.getElementById("currentRoomLabel").innerText = `Room: ${roomId}`;
  window.history.pushState({}, "", `/game/${roomId}`);
  renderBoard();
});

socket.on("invalidMove", (data) => {
  console.warn("Invalid move rejected by server:", data);
  renderBoard();
});

// -------------------------------------------------------------
// Header & UI Updates
// -------------------------------------------------------------
function updatePlayerHeader(state) {
  const whiteName = state.white ? state.white.username : "Waiting for White...";
  const blackName = state.black ? state.black.username : "Waiting for Black...";

  const isWhiteMe = playerRole === "w";
  const bottomName = isWhiteMe ? whiteName : blackName;
  const topName = isWhiteMe ? blackName : whiteName;

  document.getElementById("bottomPlayerName").innerText = bottomName;
  document.getElementById("topPlayerName").innerText = topName;

  document.getElementById("spectatorsCount").innerText = state.spectatorsCount || 0;

  const turnText = state.turn === "w" ? "White's turn" : "Black's turn";
  document.getElementById("turnIndicator").innerHTML = `
    <span class="w-2 h-2 rounded-full ${state.turn === "w" ? "bg-white" : "bg-zinc-400"}"></span>
    ${state.status === "active" ? turnText : state.status.toUpperCase()}
  `;
}

function updateMoveHistory(moves) {
  const movesContainer = document.getElementById("movesList");
  if (!moves || moves.length === 0) {
    movesContainer.innerHTML = '<p class="text-xs text-zinc-500 italic text-center py-4">No moves played yet.</p>';
    return;
  }

  let html = "";
  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;
    const whiteMove = moves[i] || "";
    const blackMove = moves[i + 1] || "";
    html += `
      <div class="flex justify-between py-1 px-2 hover:bg-zinc-800/50 rounded text-xs">
        <span class="text-zinc-500 font-semibold">${moveNumber}.</span>
        <span class="text-emerald-400 font-medium">${whiteMove}</span>
        <span class="text-zinc-300 font-medium">${blackMove}</span>
      </div>
    `;
  }
  movesContainer.innerHTML = html;
  movesContainer.scrollTop = movesContainer.scrollHeight;
}

function syncTimers(timers, activeTurn, status) {
  if (clockInterval) clearInterval(clockInterval);

  let whiteSeconds = Math.max(0, Math.floor(timers.white));
  let blackSeconds = Math.max(0, Math.floor(timers.black));

  updateClockDisplay("bottomClock", playerRole === "w" ? whiteSeconds : blackSeconds);
  updateClockDisplay("topClock", playerRole === "w" ? blackSeconds : whiteSeconds);

  if (status === "active") {
    clockInterval = setInterval(() => {
      if (activeTurn === "w") {
        whiteSeconds = Math.max(0, whiteSeconds - 1);
      } else {
        blackSeconds = Math.max(0, blackSeconds - 1);
      }

      updateClockDisplay("bottomClock", playerRole === "w" ? whiteSeconds : blackSeconds);
      updateClockDisplay("topClock", playerRole === "w" ? blackSeconds : whiteSeconds);
    }, 1000);
  }
}

function updateClockDisplay(elementId, totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const el = document.getElementById(elementId);
  if (el) {
    el.innerText = formatted;
    if (totalSeconds <= 30) {
      el.classList.add("text-red-400", "animate-pulse");
    } else {
      el.classList.remove("text-red-400", "animate-pulse");
    }
  }
}

function showGameOverBanner(winner, reason) {
  const banner = document.getElementById("gameStatusBanner");
  const title = document.getElementById("bannerTitle");
  const subtitle = document.getElementById("bannerSubtitle");

  banner.classList.remove("hidden");

  if (winner === "draw") {
    title.innerText = "Game Drawn";
    subtitle.innerText = `Reason: ${reason || "Agreement"}`;
  } else {
    const winnerName = winner === "w" ? "White" : "Black";
    title.innerText = `${winnerName} Wins!`;
    subtitle.innerText = `By ${reason || "Checkmate"}`;
  }
}

// -------------------------------------------------------------
// UI Event Handlers & Matchmaking
// -------------------------------------------------------------
function setupEventListeners() {
  // Matchmaking
  const findMatchBtn = document.getElementById("findMatchBtn");
  const cancelQueueBtn = document.getElementById("cancelQueueBtn");

  findMatchBtn.addEventListener("click", () => {
    socket.emit("findMatch", currentUser);
    findMatchBtn.classList.add("hidden");
    document.getElementById("queueStatus").classList.remove("hidden");
  });

  cancelQueueBtn.addEventListener("click", () => {
    socket.emit("cancelMatchmaking");
    document.getElementById("queueStatus").classList.add("hidden");
    findMatchBtn.classList.remove("hidden");
  });

  // Create / Join Custom Room
  document.getElementById("createRoomBtn").addEventListener("click", () => {
    const randomCode = `room_${Math.random().toString(36).substring(2, 8)}`;
    window.location.href = `/game/${randomCode}`;
  });

  document.getElementById("joinRoomBtn").addEventListener("click", () => {
    const code = document.getElementById("roomCodeInput").value.trim();
    if (code) {
      window.location.href = `/game/${code}`;
    }
  });

  // Resign & Actions
  document.getElementById("resignBtn").addEventListener("click", () => {
    if (confirm("Are you sure you want to resign this match?")) {
      socket.emit("resign", { roomId: currentRoomId });
    }
  });

  document.getElementById("copyLinkBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied to clipboard! Share it with a friend.");
  });

  document.getElementById("playAgainBtn").addEventListener("click", () => {
    document.getElementById("gameStatusBanner").classList.add("hidden");
    document.getElementById("findMatchBtn").click();
  });

  // Pawn Promotion choices
  document.querySelectorAll(".promotion-choice").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const pieceType = e.target.dataset.piece;
      document.getElementById("promotionModal").classList.add("hidden");
      if (pendingPromotionMove) {
        sendMove({
          from: pendingPromotionMove.from,
          to: pendingPromotionMove.to,
          promotion: pieceType,
        });
        pendingPromotionMove = null;
      }
    });
  });

  // Tab Switching
  const tabMovesBtn = document.getElementById("tabMovesBtn");
  const tabLeaderboardBtn = document.getElementById("tabLeaderboardBtn");
  const tabMoves = document.getElementById("tabMoves");
  const tabLeaderboard = document.getElementById("tabLeaderboard");

  tabMovesBtn.addEventListener("click", () => {
    tabMoves.classList.remove("hidden");
    tabLeaderboard.classList.add("hidden");
    tabMovesBtn.className = "flex-1 py-3 text-center border-b-2 border-emerald-500 text-emerald-400";
    tabLeaderboardBtn.className = "flex-1 py-3 text-center text-zinc-400 hover:text-zinc-200";
  });

  tabLeaderboardBtn.addEventListener("click", () => {
    tabLeaderboard.classList.remove("hidden");
    tabMoves.classList.add("hidden");
    tabLeaderboardBtn.className = "flex-1 py-3 text-center border-b-2 border-emerald-500 text-emerald-400";
    tabMovesBtn.className = "flex-1 py-3 text-center text-zinc-400 hover:text-zinc-200";
    fetchLeaderboard();
  });

  // Auth Modal
  setupAuthModal();
}

// -------------------------------------------------------------
// Auth & API Interactions
// -------------------------------------------------------------
function setupAuthModal() {
  const authModal = document.getElementById("authModal");
  const authModalBtn = document.getElementById("authModalBtn");
  const closeAuthModal = document.getElementById("closeAuthModal");
  const authForm = document.getElementById("authForm");
  const authTabLogin = document.getElementById("authTabLogin");
  const authTabRegister = document.getElementById("authTabRegister");
  const usernameField = document.getElementById("usernameField");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authErrorMsg = document.getElementById("authErrorMsg");

  let isRegisterMode = false;

  authModalBtn.addEventListener("click", () => {
    if (currentUser) {
      // Logout
      localStorage.removeItem("token");
      currentUser = null;
      document.getElementById("userDisplayName").innerText = "Sign In";
      window.location.reload();
    } else {
      authModal.classList.remove("hidden");
    }
  });

  closeAuthModal.addEventListener("click", () => authModal.classList.add("hidden"));

  authTabLogin.addEventListener("click", () => {
    isRegisterMode = false;
    authTabLogin.className = "flex-1 text-emerald-400 border-b-2 border-emerald-500 pb-1";
    authTabRegister.className = "flex-1 text-zinc-400 pb-1";
    usernameField.classList.add("hidden");
    authSubmitBtn.innerText = "Sign In";
  });

  authTabRegister.addEventListener("click", () => {
    isRegisterMode = true;
    authTabRegister.className = "flex-1 text-emerald-400 border-b-2 border-emerald-500 pb-1";
    authTabLogin.className = "flex-1 text-zinc-400 pb-1";
    usernameField.classList.remove("hidden");
    authSubmitBtn.innerText = "Create Account";
  });

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authErrorMsg.classList.add("hidden");

    const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
    const payload = isRegisterMode
      ? {
          username: document.getElementById("authUsername").value.trim(),
          email: document.getElementById("authEmail").value.trim(),
          password: document.getElementById("authPassword").value,
        }
      : {
          emailOrUsername: document.getElementById("authEmail").value.trim(),
          password: document.getElementById("authPassword").value,
        };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Authentication failed");
      }

      localStorage.setItem("token", data.token);
      currentUser = data.user;
      document.getElementById("userDisplayName").innerText = `${currentUser.username} (${currentUser.rating || 1200})`;
      authModal.classList.add("hidden");
      window.location.reload();
    } catch (err) {
      authErrorMsg.innerText = err.message;
      authErrorMsg.classList.remove("hidden");
    }
  });
}

async function checkAuthStatus() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      document.getElementById("userDisplayName").innerText = `${currentUser.username} (${currentUser.rating || 1200})`;
    }
  } catch (err) {
    console.warn("Failed to check auth status:", err);
  }
}

async function fetchLeaderboard() {
  try {
    const res = await fetch("/api/games/leaderboard");
    const data = await res.json();
    const list = document.getElementById("leaderboardList");

    if (data.success && data.data.length > 0) {
      list.innerHTML = data.data
        .map(
          (u, idx) => `
          <div class="flex items-center justify-between p-2.5 bg-zinc-800/40 rounded-lg border border-zinc-800 text-xs">
            <div class="flex items-center gap-2.5">
              <span class="font-bold text-zinc-500 w-4">${idx + 1}.</span>
              <span class="font-semibold text-zinc-200">${u.username}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-emerald-400 font-bold">${u.rating}</span>
              <span class="text-zinc-500">ELO</span>
            </div>
          </div>
        `
        )
        .join("");
    }
  } catch (err) {
    console.warn("Failed to fetch leaderboard:", err);
  }
}
