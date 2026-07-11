import express from "express";
import cors from "cors";
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(Number(process.env.PORT ?? 3000), () => console.log("CORTA QC API on", process.env.PORT ?? 3000));
