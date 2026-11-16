import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ModelFeedbackSchema, TutorResponseSchema, buildModelResponseJsonSchema } from "./tutorResponse.js";
import { validModelOutput } from "../testing/fakes.js";

// Testes de aprendizado: fixam o que sabemos sobre o formato do JSON Schema enviado ao Gemini.
// Se uma atualização do zod ou do SDK mudar isso, estes testes avisam ANTES de chegar na API real.
describe("buildModelResponseJsonSchema (aprendizado)", () => {
  const schema = buildModelResponseJsonSchema() as {
    type?: string;
    required?: string[];
    properties?: Record<string, unknown>;
    $schema?: string;
  };

  it("descreve um objeto com exatamente os campos que o modelo deve gerar", () => {
    assert.equal(schema.type, "object");
    assert.deepEqual(Object.keys(schema.properties ?? {}).sort(), ["analiseAluno", "assuntos", "contextualizacao", "explicacao", "recomendacoes"]);
    assert.deepEqual([...(schema.required ?? [])].sort(), ["analiseAluno", "assuntos", "contextualizacao", "explicacao", "recomendacoes"]);
  });

  it("não expõe ao modelo os campos que o servidor decide (resultado, materiais)", () => {
    assert.equal("resultado" in (schema.properties ?? {}), false);
    assert.equal("materiais" in (schema.properties ?? {}), false);
  });

  it("pede os assuntos como lista de textos", () => {
    const assuntos = (schema.properties as Record<string, { type?: string; items?: { type?: string } }>).assuntos;

    assert.equal(assuntos?.type, "array");
    assert.equal(assuntos?.items?.type, "string");
  });

  it("não envia a palavra-chave $schema", () => {
    assert.equal("$schema" in schema, false);
  });
});

describe("ModelFeedbackSchema", () => {
  it("aceita a saída esperada", () => {
    assert.equal(ModelFeedbackSchema.safeParse(validModelOutput()).success, true);
  });

  it("rejeita texto em branco e lista de recomendações vazia", () => {
    const blank = { ...validModelOutput(), explicacao: { titulo: "  ", conteudo: "x" } };
    const noRecommendations = { ...validModelOutput(), recomendacoes: [] };

    assert.equal(ModelFeedbackSchema.safeParse(blank).success, false);
    assert.equal(ModelFeedbackSchema.safeParse(noRecommendations).success, false);
  });

  it("aceita assuntos vazios (sem catálogo) e exige o campo", () => {
    const { assuntos: _omitted, ...withoutAssuntos } = validModelOutput();

    assert.equal(ModelFeedbackSchema.safeParse({ ...validModelOutput(), assuntos: [] }).success, true);
    assert.equal(ModelFeedbackSchema.safeParse(withoutAssuntos).success, false);
  });

  it("tolera mais de 3 assuntos: quem corta é o servidor, para um campo secundário não derrubar a tutoria", () => {
    assert.equal(ModelFeedbackSchema.safeParse({ ...validModelOutput(), assuntos: ["a", "b", "c", "d"] }).success, true);
  });
});

describe("TutorResponseSchema", () => {
  it("rejeita um material com URL inválida", () => {
    const response = {
      resultado: "correto",
      explicacao: { titulo: "t", conteudo: "c" },
      analiseAluno: { alternativa: "B", conteudo: "c" },
      contextualizacao: { titulo: "t", conteudo: "c" },
      recomendacoes: ["r"],
      materiais: [{ titulo: "t", url: "não é url", descricao: "d" }],
    };

    assert.equal(TutorResponseSchema.safeParse(response).success, false);
  });
});
