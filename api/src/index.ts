import express from "express";
import cors from "cors";
import { correlationId, requestLogger } from "./util";
import { errorHandler, notFound } from "./errors";
import { authRouter } from "./routes/auth";
import { apiRouter } from "./routes/crud";
import { logger } from "./logger";
import { pool } from "./db";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? "*" }));
app.use(express.json({ limit: "2mb" }));
app.use(correlationId);
app.use(requestLogger);

app.get("/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, db: "up" }); }
  catch { res.status(503).json({ ok: false, db: "down" }); }
});

app.use("/auth", authRouter);
app.use("/", apiRouter);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => logger.info({ msg: "CORTA QC API listening", port }));
