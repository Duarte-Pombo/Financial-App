import express from "express";
import cors from "cors";
import { getDb } from "./db";
import insightsRouter from "./routes/insights";
import notificationsRouter from "./routes/notifications";
import transactionsRouter from "./routes/transactions";
import emotionsRouter from "./routes/emotions";
import usersRouter from "./routes/users";
import achievementsRouter from "./routes/achievements";

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Awared server on :${PORT}`));

