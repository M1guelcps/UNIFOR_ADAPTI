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
import type { GeminiContentGenerator } from "./geminiTutorModel.js";

type Outcome = { text: string | undefined } | Error;

function modelWith(outcome: Outcome) {
  const requests: GenerateContentParameters[] = [];
  const client: GeminiContentGenerator = {
    async generateContent(params) {
      requests.push(params);
      if (outcome instanceof Error) throw outcome;
      return outcome as GenerateContentResponse;
    },
  };
  return { requests, model: new GeminiTutorModel({ client, model: "modelo-teste", timeoutMs: 1234 }) };
}

describe("GeminiTutorModel", () => {
  it("devolve o JSON parseado quando o Gemini responde com texto válido", async () => {
    const { model } = modelWith({ text: '{"ok":true}' });

    assert.deepEqual(await model.generateFeedback("conteúdo"), { ok: true });
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

  it("traduz HTTP 429 para TutorRateLimitedError", async () => {
    const { model } = modelWith(new ApiError({ message: "quota", status: 429 }));

    await assert.rejects(() => model.generateFeedback("x"), TutorRateLimitedError);
  });

  it("traduz HTTP 503 para TutorUnavailableError", async () => {
    const { model } = modelWith(new ApiError({ message: "overloaded", status: 503 }));

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
