import express from "express";
import insightsRouter from "./routes/insights";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use("/api/insights", insightsRouter);

app.listen(3000, () => console.log("Awared server on :3000"));
