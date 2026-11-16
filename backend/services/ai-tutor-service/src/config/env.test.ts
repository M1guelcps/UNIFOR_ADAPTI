import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "./env.js";

const validEnv = {
  DATABASE_URL: "mysql://u:p@localhost:3306/adapti_tutor",
  GEMINI_API_KEY: "chave-gemini-secreta",
  GEMINI_MODEL: "modelo-x",
  INTERNAL_API_KEY: "uma-chave-interna-longa",
};

describe("loadConfig", () => {
  it("aplica os valores padrão de porta e timeout", () => {
    const config = loadConfig(validEnv);

    assert.equal(config.port, 3005);
    assert.equal(config.geminiTimeoutMs, 25_000);
  });

  it("converte PORT e GEMINI_TIMEOUT_MS de texto para número", () => {
    const config = loadConfig({ ...validEnv, PORT: "4000", GEMINI_TIMEOUT_MS: "1500" });

    assert.equal(config.port, 4000);
    assert.equal(config.geminiTimeoutMs, 1500);
  });

  it("falha apontando a variável ausente", () => {
    const { GEMINI_MODEL: _omitted, ...withoutModel } = validEnv;

    assert.throws(() => loadConfig(withoutModel), /GEMINI_MODEL/);
  });

  it("exige uma chave interna com pelo menos 16 caracteres", () => {
    assert.throws(() => loadConfig({ ...validEnv, INTERNAL_API_KEY: "curta" }), /INTERNAL_API_KEY/);
  });

  it("nunca inclui valores de segredos na mensagem de erro", () => {
    assert.throws(
      () => loadConfig({ ...validEnv, INTERNAL_API_KEY: "curta", GEMINI_MODEL: "" }),
      (error: unknown) => error instanceof Error && !error.message.includes("chave-gemini-secreta") && !error.message.includes("curta")
    );
  });
});

describe("loadConfig: variáveis de robustez", () => {
  it("usa 4 chamadas simultâneas por padrão e deixa reserva e raciocínio indefinidos", () => {
    const config = loadConfig(validEnv);

    assert.equal(config.geminiMaxConcurrency, 4);
    assert.equal(config.geminiFallbackModel, undefined);
    assert.equal(config.geminiThinkingLevel, undefined);
  });

  it("trata variáveis opcionais vazias (como no .env.example) como ausentes", () => {
    const config = loadConfig({ ...validEnv, GEMINI_FALLBACK_MODEL: "", GEMINI_THINKING_LEVEL: "  " });

    assert.equal(config.geminiFallbackModel, undefined);
    assert.equal(config.geminiThinkingLevel, undefined);
  });

  it("lê o modelo reserva, o nível de raciocínio (sem diferenciar maiúsculas) e o limite", () => {
    const config = loadConfig({
      ...validEnv,
      GEMINI_FALLBACK_MODEL: "modelo-reserva",
      GEMINI_THINKING_LEVEL: "low",
      GEMINI_MAX_CONCURRENCY: "8",
    });

    assert.equal(config.geminiFallbackModel, "modelo-reserva");
    assert.equal(config.geminiThinkingLevel, "LOW");
    assert.equal(config.geminiMaxConcurrency, 8);
  });

  it("rejeita nível de raciocínio desconhecido e limite fora da faixa", () => {
    assert.throws(() => loadConfig({ ...validEnv, GEMINI_THINKING_LEVEL: "extremo" }), /GEMINI_THINKING_LEVEL/);
    assert.throws(() => loadConfig({ ...validEnv, GEMINI_MAX_CONCURRENCY: "0" }), /GEMINI_MAX_CONCURRENCY/);
  });
});
