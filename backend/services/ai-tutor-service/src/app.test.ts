import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createApp } from "./app.js";
import { TutorRateLimitedError, TutorUnavailableError } from "./domain/tutorErrors.js";
import { INTERNAL_KEY_HEADER } from "./middlewares/internalAuth.js";
import { TutorService } from "./services/tutorService.js";
import { FakeTutorModel, InMemoryFeedbackRepository, validModelOutput, validRequest } from "./testing/fakes.js";

const INTERNAL_KEY = "chave-interna-de-teste-123";

describe("API HTTP do AI Tutor", () => {
  let server: Server;
  let baseUrl: string;
  let model: FakeTutorModel;

  async function start(...script: unknown[]) {
    model = new FakeTutorModel(...script);
    const app = createApp({ tutorService: new TutorService(model, new InMemoryFeedbackRepository()), internalApiKey: INTERNAL_KEY });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const post = (body: unknown, headers: Record<string, string> = { [INTERNAL_KEY_HEADER]: INTERNAL_KEY }) =>
    fetch(`${baseUrl}/ai-tutor/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  beforeEach(() => start(validModelOutput()));
  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("GET /health responde online sem exigir chave", async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { service: "ai-tutor-service", status: "online" });
  });

  it("devolve 401 sem a chave interna e não chama o modelo", async () => {
    const response = await post(validRequest(), {});

    assert.equal(response.status, 401);
    assert.equal(model.calls, 0);
  });

  it("devolve 401 com chave interna errada", async () => {
    const response = await post(validRequest(), { [INTERNAL_KEY_HEADER]: "outra-chave" });

    assert.equal(response.status, 401);
  });

  it("devolve 400 com os problemas de validação quando falta o enunciado", async () => {
    const response = await post({ ...validRequest(), enunciado: "" });
    const body = (await response.json()) as { error: string; details: unknown[] };

    assert.equal(response.status, 400);
    assert.equal(body.details.length > 0, true);
    assert.equal(model.calls, 0);
  });

  it("devolve 400 JSON para corpo malformado", async () => {
    const response = await post("{isso não é json");

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  });

  it("devolve 200 com o feedback no contrato público do doc", async () => {
    const response = await post(validRequest());
    const body = (await response.json()) as { data: Record<string, unknown>; cached: boolean };

    assert.equal(response.status, 200);
    assert.equal(body.cached, false);
    assert.deepEqual(Object.keys(body.data).sort(), ["analiseAluno", "contextualizacao", "explicacao", "materiais", "recomendacoes", "resultado"]);
    assert.equal(body.data.resultado, "incorreto");
  });

  it("marca cached=true na segunda chamada idêntica", async () => {
    await post(validRequest());
    const second = (await (await post(validRequest())).json()) as { cached: boolean };

    assert.equal(second.cached, true);
    assert.equal(model.calls, 1);
  });

  it("devolve 429 com Retry-After quando o provedor limita", async () => {
    await afterAndRestart(new TutorRateLimitedError(17));

    const response = await post(validRequest());

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "17");
  });

  it("devolve 503 quando o provedor está indisponível", async () => {
    await afterAndRestart(new TutorUnavailableError());

    assert.equal((await post(validRequest())).status, 503);
  });

  it("devolve 502 quando o modelo insiste em saída inválida", async () => {
    await afterAndRestart({ lixo: 1 }, { lixo: 2 });

    assert.equal((await post(validRequest())).status, 502);
  });

  async function afterAndRestart(...script: unknown[]) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await start(...script);
  }
});
