import express from "express";
import cors from "cors";
import { getDb } from "./db";
import insightsRouter from "./routes/insights";
import notificationsRouter from "./routes/notifications";
import transactionsRouter from "./routes/transactions";
import emotionsRouter from "./routes/emotions";
import usersRouter from "./routes/users";
import achievementsRouter from "./routes/achievements";

process.on('beforeExit', (code) => {
	console.warn(`[TRAP] Node's event loop is EMPTY. It thinks there is no server running. (Code: ${code})`);
});

process.on('exit', (code) => {
	console.warn(`[TRAP] Process is officially shutting down with code: ${code}`);
});

process.on('uncaughtException', (err) => {
	console.error(`[TRAP] CRITICAL FATAL ERROR:`, err);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error(`[TRAP] Unhandled Promise Rejection:`, reason);
});
// -------------------------------

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
	const start = Date.now();
	console.log(`[SERVER] ${req.method} ${req.url} | origin: ${req.headers.origin || "none"} | user-agent: ${req.headers["user-agent"]?.slice(0, 40)}`);

	res.on("finish", () => {
		const duration = Date.now() - start;
		console.log(`[SERVER] ${req.method} ${req.url} → ${res.statusCode} in ${duration}ms`);
	});
	next();
});

// Warm up the DB connection on startup
getDb();

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/insights", insightsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/emotions", emotionsRouter);
app.use("/api/users", usersRouter);
app.use("/api/achievements", achievementsRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
	res.json({ ok: true, service: "awared-server", timestamp: new Date().toISOString() });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = 8080;

const server = app.listen(PORT, "0.0.0.0", () => {
	console.log(`Awared server on http://0.0.0.0:${PORT}`);
	console.log(`[DEBUG] Is the server actively listening right now? ${server.listening}`);
});

// If the server socket closes itself, this will tell us
server.on('close', () => {
	console.warn("[TRAP] The Express server socket just closed itself!");
});
