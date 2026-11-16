import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  TutorInvalidOutputError,
  TutorRateLimitedError,
  TutorUnavailableError,
} from "../domain/tutorErrors.js";
import { TUTOR_SYSTEM_PROMPT } from "../prompts/tutorPrompt.js";
import { GeminiTutorModel } from "./geminiTutorModel.js";
import type { GeminiContentGenerator, GeminiTutorModelOptions } from "./geminiTutorModel.js";

type Outcome = { text: string | undefined; usageMetadata?: Record<string, number> } | Error;

/** Cada chamada ao cliente consome o próximo resultado; o último se repete. */
function modelWith(outcomes: Outcome | Outcome[], extra: Partial<GeminiTutorModelOptions> = {}) {
  const script = Array.isArray(outcomes) ? [...outcomes] : [outcomes];
  const requests: GenerateContentParameters[] = [];
  const sleeps: number[] = [];
  const logs: string[] = [];
  const client: GeminiContentGenerator = {
    async generateContent(params) {
      requests.push(params);
      const outcome = script.length > 1 ? script.shift()! : script[0]!;
      if (outcome instanceof Error) throw outcome;
      return outcome as GenerateContentResponse;
    },
  };
  const model = new GeminiTutorModel({
    client,
    model: "modelo-teste",
    timeoutMs: 1234,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    log: (line) => logs.push(line),
    ...extra,
  });
  return { requests, sleeps, logs, model };
}

const unavailable = (status = 503) => new ApiError({ message: "overloaded", status });

describe("GeminiTutorModel", () => {
  it("devolve o JSON parseado, o modelo que respondeu e o uso de tokens", async () => {
    const { model } = modelWith({
      text: '{"ok":true}',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 5, totalTokenCount: 35 },
    });

    const completion = await model.generateFeedback("conteúdo");

    assert.deepEqual(completion.data, { ok: true });
    assert.equal(completion.model, "modelo-teste");
    assert.deepEqual(completion.usage, { promptTokens: 10, outputTokens: 20, thoughtsTokens: 5, totalTokens: 35 });
  });

  it("separa as regras (systemInstruction) dos dados da questão (contents) e pede JSON estruturado", async () => {
    const { model, requests } = modelWith({ text: "{}" });

    await model.generateFeedback("DADOS DA QUESTÃO");

    const request = requests[0];
    assert.equal(request?.model, "modelo-teste");
    assert.equal(request?.contents, "DADOS DA QUESTÃO");
    assert.equal(request?.config?.systemInstruction, TUTOR_SYSTEM_PROMPT);
    assert.equal(request?.config?.responseMimeType, "application/json");
    assert.equal(typeof request?.config?.responseJsonSchema, "object");
    assert.equal(request?.config?.httpOptions?.timeout, 1234);
  });

  it("só envia thinkingConfig quando o nível foi configurado", async () => {
    const without = modelWith({ text: "{}" });
    const withLevel = modelWith({ text: "{}" }, { thinkingLevel: "LOW" });

    await without.model.generateFeedback("x");
    await withLevel.model.generateFeedback("x");

    assert.equal(without.requests[0]?.config?.thinkingConfig, undefined);
    assert.equal(withLevel.requests[0]?.config?.thinkingConfig?.thinkingLevel, "LOW");
  });

  describe("erros do provedor", () => {
    it("traduz HTTP 429 para TutorRateLimitedError", async () => {
      const { model } = modelWith(new ApiError({ message: "quota", status: 429 }));

      await assert.rejects(() => model.generateFeedback("x"), TutorRateLimitedError);
    });

    it("traduz HTTP 503 persistente para TutorUnavailableError", async () => {
      const { model } = modelWith(unavailable());

      await assert.rejects(() => model.generateFeedback("x"), TutorUnavailableError);
    });

    it("trata chave/modelo recusados (HTTP 403) como indisponibilidade com dica de configuração", async () => {
      const { model } = modelWith(new ApiError({ message: "forbidden", status: 403 }));

      await assert.rejects(
        () => model.generateFeedback("x"),
        (error: unknown) => error instanceof TutorUnavailableError && error.message.includes("GEMINI_API_KEY")
      );
    });

    it("não repete a mensagem original do provedor na mensagem traduzida", async () => {
      const { model } = modelWith(new ApiError({ message: "detalhe-sensivel-da-requisicao", status: 500 }));

      await assert.rejects(
        () => model.generateFeedback("x"),
        (error: unknown) => error instanceof Error && !error.message.includes("detalhe-sensivel")
      );
    });

    it("traduz falha de rede/timeout para TutorUnavailableError", async () => {
      const { model } = modelWith(new TypeError("fetch failed"));

      await assert.rejects(() => model.generateFeedback("x"), TutorUnavailableError);
    });

    it("rejeita resposta sem texto (ex.: bloqueio de segurança)", async () => {
      const { model } = modelWith({ text: undefined });

      await assert.rejects(() => model.generateFeedback("x"), TutorInvalidOutputError);
    });

    it("rejeita texto que não é JSON", async () => {
      const { model } = modelWith({ text: "Claro! Aqui está a explicação..." });

      await assert.rejects(() => model.generateFeedback("x"), TutorInvalidOutputError);
    });
  });

  describe("nova tentativa após erro 5xx", () => {
    it("repete uma vez depois de 1 a 2 s e recupera quando o Gemini volta", async () => {
      const { model, requests, sleeps } = modelWith([unavailable(), { text: '{"ok":true}' }]);

      const completion = await model.generateFeedback("x");

      assert.deepEqual(completion.data, { ok: true });
      assert.equal(requests.length, 2);
      assert.equal(sleeps.length, 1);
      assert.ok(sleeps[0]! >= 1000 && sleeps[0]! <= 2000, `espera de ${sleeps[0]} ms fora de 1–2 s`);
    });

    it("desiste depois da segunda falha: no máximo duas chamadas", async () => {
      const { model, requests } = modelWith(unavailable());

      await assert.rejects(() => model.generateFeedback("x"), TutorUnavailableError);
      assert.equal(requests.length, 2);
    });

    it("usa o modelo reserva na nova tentativa e informa qual respondeu", async () => {
      const { model, requests } = modelWith([unavailable(), { text: "{}" }], { fallbackModel: "modelo-reserva" });

      const completion = await model.generateFeedback("x");

      assert.deepEqual(requests.map((request) => request.model), ["modelo-teste", "modelo-reserva"]);
      assert.equal(completion.model, "modelo-reserva");
    });

    it("repete o modelo principal quando não há reserva configurado", async () => {
      const { model, requests } = modelWith([unavailable(500), { text: "{}" }]);

      const completion = await model.generateFeedback("x");

      assert.deepEqual(requests.map((request) => request.model), ["modelo-teste", "modelo-teste"]);
      assert.equal(completion.model, "modelo-teste");
    });

    it("não repete 429 (repetir só gasta mais cota)", async () => {
      const { model, requests, sleeps } = modelWith(new ApiError({ message: "quota", status: 429 }));

      await assert.rejects(() => model.generateFeedback("x"), TutorRateLimitedError);
      assert.equal(requests.length, 1);
      assert.equal(sleeps.length, 0);
    });

    it("não repete erro 4xx de configuração", async () => {
      const { model, requests } = modelWith(new ApiError({ message: "forbidden", status: 403 }));

      await assert.rejects(() => model.generateFeedback("x"), TutorUnavailableError);
      assert.equal(requests.length, 1);
    });

    it("não repete timeout nem falha de rede (dobraria a espera do aluno)", async () => {
      const { model, requests } = modelWith(new TypeError("fetch failed"));

      await assert.rejects(() => model.generateFeedback("x"), TutorUnavailableError);
      assert.equal(requests.length, 1);
    });

    it("não repete resposta inválida: quem decide é o TutorService", async () => {
      const { model, requests } = modelWith({ text: "isso não é JSON" });

      await assert.rejects(() => model.generateFeedback("x"), TutorInvalidOutputError);
      assert.equal(requests.length, 1);
    });
  });

  describe("métricas por chamada", () => {
    it("registra modelo, tentativa, latência e tokens, sem o conteúdo da questão", async () => {
      const { model, logs } = modelWith({
        text: "{}",
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 30, totalTokenCount: 330 },
      });

      await model.generateFeedback("ENUNCIADO SECRETO");

      assert.equal(logs.length, 1);
      const line = logs[0]!;
      assert.match(line, /^\[TUTOR GEMINI\] model=modelo-teste attempt=1 latencyMs=\d+ outcome=ok /);
      assert.match(line, /promptTokens=100 outputTokens=200 thoughtsTokens=30 totalTokens=330$/);
      assert.equal(line.includes("ENUNCIADO SECRETO"), false);
    });

    it("registra cada tentativa, inclusive a que falhou", async () => {
      const { model, logs } = modelWith([unavailable(), { text: "{}" }], { fallbackModel: "modelo-reserva" });

      await model.generateFeedback("x");

      assert.equal(logs.length, 2);
      assert.match(logs[0]!, /model=modelo-teste attempt=1 .*outcome=http_503/);
      assert.match(logs[1]!, /model=modelo-reserva attempt=2 .*outcome=ok/);
    });

    it("omite os campos de tokens que o provedor não informou", async () => {
      const { model, logs } = modelWith({ text: "{}" });

      await model.generateFeedback("x");

      assert.equal(logs[0]!.includes("Tokens="), false);
    });
  });
});
