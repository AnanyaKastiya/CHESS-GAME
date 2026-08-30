# ♟️ ChessMate: Distributed Real-Time Multiplayer Chess Platform
> 🔗 **Live Demo:** [https://chess-game-608k.onrender.com](https://chess-game-608k.onrender.com)

A production-grade, server-authoritative multiplayer chess platform engineered with **Node.js, Express.js, Socket.IO, MongoDB, Redis, and FIDE-compliant chess logic**. Built with clean MVC architecture, dynamic room isolation, JWT authentication, server-authoritative clocks with lag compensation, and automated backend test suites.

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

## Author
Ananya Kastiya
