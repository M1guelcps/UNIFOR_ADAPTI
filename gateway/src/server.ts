import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", service: "api-gateway" });
});

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3001";

const QUEST_SERVICE_URL =
  process.env.QUEST_SERVICE_URL || "http://localhost:3002";

const ANSWER_SERVICE_URL =
  process.env.ANSWER_SERVICE_URL || "http://localhost:3003";

const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:3004";

// Auth Service
app.use(
  "/auth",
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^": "/auth" },
  })
);

// Quest Service
app.use(
  "/quests",
  createProxyMiddleware({
    target: QUEST_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^": "/quests" },
  })
);

// Answer Service
app.use(
  "/answers",
  createProxyMiddleware({
    target: ANSWER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^": "/answers" },
    on: {
      error: (err, req, res) => {
        console.error("[GATEWAY] Erro no Answer Service:", err.message);

        if ("status" in res && typeof res.status === "function") {
          res.status(503).json({
            error: "Answer Service indisponível no momento.",
          });
        }
      },
    },
  })
);

// User Service
app.use(
  "/users",
  createProxyMiddleware({
    target: USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^": "/users" },
  })
);

// Inicie o servidor somente depois de registrar as rotas.
app.listen(PORT, () => {
  console.log(`🌐 API Gateway rodando na porta ${PORT}`);
});