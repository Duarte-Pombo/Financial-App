import express from "express";
import insightsRouter from "./routes/insights";
import notificationsRouter from "./routes/notifications";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use("/api/insights", insightsRouter);
app.use("/api/notifications", notificationsRouter);

app.listen(3000, () => console.log("Awared server on :3000"));
