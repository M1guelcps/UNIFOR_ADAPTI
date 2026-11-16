import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, it } from "node:test";
import { requestTutorFeedback } from "./aiTutorClient.js";
import type { TutorRequestPayload } from "./aiTutorContract.js";
import { TutorRateLimitedError, TutorUnavailableError } from "./tutorErrors.js";

const payload: TutorRequestPayload = {
  questaoId: "550e8400-e29b-41d4-a716-446655440000",
  enunciado: "Qual é a principal função de um banco de dados?",
  alternativas: [
    { letra: "A", texto: "Executar sistemas operacionais" },
    { letra: "B", texto: "Armazenar e organizar informações" },
  ],
  respostaCorreta: "B",
  respostaAluno: "A",
};

const feedback = {
  resultado: "incorreto",
  explicacao: { titulo: "t", conteudo: "c" },
  analiseAluno: { alternativa: "A", conteudo: "c" },
  contextualizacao: { titulo: "t", conteudo: "c" },
  recomendacoes: ["r"],
  materiais: [],
};

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

// Servidor HTTP de verdade (porta efêmera) no lugar do AI Tutor Service: testa o fetch real, sem mock.
describe("requestTutorFeedback", () => {
  let server: Server;
  let received: { headers: IncomingMessage["headers"]; body: string; url?: string } | undefined;
  const saved = { url: process.env.AI_TUTOR_URL, key: process.env.INTERNAL_API_KEY };

  async function respondWith(handler: Handler) {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received = { headers: req.headers, body, url: req.url };
        handler(req, res, body);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    process.env.AI_TUTOR_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const json = (status: number, body: unknown, headers: Record<string, string> = {}): Handler => (_req, res) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };

  beforeEach(() => {
    received = undefined;
    process.env.INTERNAL_API_KEY = "chave-interna-de-teste-123";
  });

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env.AI_TUTOR_URL = saved.url;
    process.env.INTERNAL_API_KEY = saved.key;
    if (saved.url === undefined) delete process.env.AI_TUTOR_URL;
    if (saved.key === undefined) delete process.env.INTERNAL_API_KEY;
  });

  it("envia o payload à rota /ai-tutor/explain com a chave interna", async () => {
    await respondWith(json(200, { data: feedback, cached: false }));

    await requestTutorFeedback(payload);

    assert.equal(received?.url, "/ai-tutor/explain");
    assert.equal(received?.headers["x-internal-api-key"], "chave-interna-de-teste-123");
    assert.deepEqual(JSON.parse(received?.body ?? "{}"), payload);
  });

  it("devolve o feedback e a flag cached do tutor", async () => {
    await respondWith(json(200, { data: feedback, cached: true }));

    const result = await requestTutorFeedback(payload);

    assert.deepEqual(result.feedback, feedback);
    assert.equal(result.cached, true);
  });

  it("converte HTTP 429 em TutorRateLimitedError com o Retry-After do tutor", async () => {
    await respondWith(json(429, { error: "limite" }, { "Retry-After": "17" }));

    await assert.rejects(
      () => requestTutorFeedback(payload),
      (error: unknown) => error instanceof TutorRateLimitedError && error.retryAfterSeconds === 17
    );
  });

  it("converte HTTP 503 em TutorUnavailableError", async () => {
    await respondWith(json(503, { error: "fora" }));

    await assert.rejects(() => requestTutorFeedback(payload), TutorUnavailableError);
  });

  it("trata 401 (chave interna divergente) como indisponibilidade, sem expor a chave", async () => {
    await respondWith(json(401, { error: "não autorizado" }));

    await assert.rejects(
      () => requestTutorFeedback(payload),
      (error: unknown) => error instanceof TutorUnavailableError && !error.message.includes("chave-interna-de-teste-123")
    );
  });

  it("trata resposta 200 sem o campo data como indisponibilidade", async () => {
    await respondWith(json(200, { message: "sem data" }));

    await assert.rejects(() => requestTutorFeedback(payload), TutorUnavailableError);
  });

  it("converte timeout em TutorUnavailableError", async () => {
    await respondWith(() => {
      /* nunca responde */
    });

    await assert.rejects(() => requestTutorFeedback(payload, 50), TutorUnavailableError);
  });

  it("converte conexão recusada em TutorUnavailableError", async () => {
    process.env.AI_TUTOR_URL = "http://127.0.0.1:1";

    await assert.rejects(() => requestTutorFeedback(payload, 2_000), TutorUnavailableError);
  });

  it("falha sem chamar a rede quando INTERNAL_API_KEY não está configurada", async () => {
    await respondWith(json(200, { data: feedback }));
    delete process.env.INTERNAL_API_KEY;

    await assert.rejects(() => requestTutorFeedback(payload), TutorUnavailableError);
    assert.equal(received, undefined);
  });
});
