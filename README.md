# ♟️ Grandmaster: Distributed Real-Time Multiplayer Chess Platform

A production-grade, server-authoritative multiplayer chess platform engineered with **Node.js, Express.js, Socket.IO, MongoDB, Redis, and FIDE-compliant chess logic**. Built with clean MVC architecture, dynamic room isolation, JWT authentication, server-authoritative clocks with lag compensation, and automated backend test suites.

---

## 🏗️ System Architecture

```
                               ┌─────────────────────────┐
                               │   Web Client (Browser)  │
                               │   EJS + Tailwind + JS   │
                               └────────────┬────────────┘
                                            │
                             HTTP REST / WebSocket (Socket.IO)
                                            │
                               ┌────────────▼────────────┐
                               │   Express / Socket.IO   │
                               │   Application Server    │
                               └────────────┬────────────┘
                                            │
           ┌────────────────────────────────┼────────────────────────────────┐
           │                                │                                │
           ▼                                ▼                                ▼
  ┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
  │  Authentication  │            │   Room Manager   │            │   Matchmaking    │
  │  (JWT + Bcrypt)  │            │  (Game State WS) │            │  Service (Queue) │
  └────────┬─────────┘            └────────┬─────────┘            └────────┬─────────┘
           │                               │                               │
           ▼                               ▼                               ▼
  ┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
  │ MongoDB Database │            │ FIDE Move Engine │            │   Redis Cache    │
  │ (Users & Matches)│            │  (Chess.js Core) │            │ (Queues & State) │
  └──────────────────┘            └──────────────────┘            └──────────────────┘
```

---

## 🚀 Key Engineering Highlights

1. **Server-Authoritative Game State & Anti-Cheat:**
   - Moves are strictly evaluated and executed on the backend server before state broadcasting.
   - Client modifications cannot forge illegal moves, bypass turn order, or falsify checkmates.
2. **Dynamic Room Isolation & Scalable Matchmaking:**
   - Multi-room architecture (`game:<roomId>`) enabling concurrent independent game sessions.
   - Automated FIFO matchmaking queue pairing players with randomized color allocation.
3. **Server-Synchronized Chess Clocks:**
   - Server-side time tracking with lag compensation ($10+0$, $5+3$, $3+0$).
   - Automatic timeout adjudication and flag fall enforcement.
4. **Transient Reconnection Resilience:**
   - 30-second disconnect grace period allowing players with network drops to resume their exact board position and clock state without destroying active games.
5. **FIDE ELO Rating Algorithm:**
   - Mathematical rating updates calculated dynamically upon match conclusion and persisted to MongoDB leaderboards.
6. **JWT Authentication & Role-Based Access Control:**
   - Secure password hashing with `bcryptjs` and stateless JWT verification for both REST routes and WebSocket connection upgrades.

---

## 📂 Project Structure

```
├── src/
│   ├── config/             # Database (MongoDB) & Redis cache setup
│   │   ├── db.js
│   │   └── redis.js
│   ├── controllers/        # REST route controllers (Auth, Games, Leaderboard)
│   │   ├── authController.js
│   │   └── gameController.js
│   ├── middleware/         # JWT auth protection & global error handlers
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   ├── models/             # Mongoose schemas (User, Game)
│   │   ├── Game.js
│   │   └── User.js
│   ├── routes/             # Express API routes
│   │   ├── authRoutes.js
│   │   └── gameRoutes.js
│   ├── services/           # Matchmaking & Game domain logic
│   │   └── matchmakingService.js
│   ├── sockets/            # Socket.IO handlers & multi-room state manager
│   │   ├── RoomManager.js
│   │   ├── gameSocket.js
│   │   └── index.js
│   ├── utils/              # ELO formulas & Winston logger
│   │   ├── elo.js
│   │   └── logger.js
│   ├── app.js              # Express app configuration & middleware
│   └── server.js           # Server entrypoint & graceful shutdown
├── tests/                  # Automated integration & unit test suites
│   ├── auth.test.js
│   └── game.test.js
├── public/                 # Static assets & interactive client chess scripts
│   └── js/chessgame.js
├── views/                  # Modern responsive EJS templates
│   └── index.ejs
├── Dockerfile              # Production Docker image definition
├── docker-compose.yml      # Multi-container setup (App + MongoDB + Redis)
└── package.json
```

---

## 📡 REST API & WebSocket Protocol

### REST Endpoints
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register user account | No |
| `POST` | `/api/auth/login` | Authenticate user & get JWT | No |
| `GET` | `/api/auth/me` | Fetch authenticated profile & stats | Yes (Bearer) |
| `GET` | `/api/games/history` | Get user's match history | Yes (Bearer) |
| `GET` | `/api/games/leaderboard`| Get top rated players | No |
| `GET` | `/api/games/:id` | Fetch specific match PGN & moves | No |
| `GET` | `/api/health` | Health check & system uptime | No |

### WebSocket Events (Socket.IO)
- **`findMatch`**: Enqueues player into matchmaking queue.
- **`cancelMatchmaking`**: Removes player from waiting queue.
- **`joinRoom`**: Connects player/spectator to a specific game room.
- **`move`**: Submits move (`{ from, to, promotion }`) for server-side validation.
- **`roomState`**: Authoritative broadcast of FEN, timers, move history, and turn.
- **`matchFound`**: Emitted to paired players with room ID and assigned role.
- **`resign`**: Player surrenders; awards victory to opponent.

---

## 🧪 Testing

Run the automated test suite covering authentication, move validation, turn order enforcement, and ELO calculations:

```bash
npm test
```

---

## 🐳 Quickstart with Docker Compose

To spin up the entire distributed stack (**App + MongoDB + Redis**) with a single command:

```bash
docker-compose up --build
```
Access the application at `http://localhost:3000`.

---

## 💻 Local Development Setup

1. **Clone repository and install dependencies:**
   ```bash
   git clone https://github.com/AnanyaKastiya/CHESS-GAME.git
   cd CHESS-GAME
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=super_secret_chess_jwt_key_2026_placement
   MONGO_URI=mongodb://127.0.0.1:27017/chess_game_db
   REDIS_URL=redis://127.0.0.1:6379
   LOG_LEVEL=info
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```

---

## 📄 License
ISC © Ananya Kastiya
