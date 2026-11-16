import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TutorRequestSchema } from "./tutorRequest.js";
import { validRequest } from "../testing/fakes.js";

describe("TutorRequestSchema", () => {
  it("aceita uma questão completa", () => {
    assert.equal(TutorRequestSchema.safeParse(validRequest()).success, true);
  });

  it("normaliza letras minúsculas para maiúsculas", () => {
    const parsed = TutorRequestSchema.parse(validRequest({ respostaCorreta: "b", respostaAluno: "c" }));

    assert.equal(parsed.respostaCorreta, "B");
    assert.equal(parsed.respostaAluno, "C");
  });

  it("rejeita enunciado vazio", () => {
    assert.equal(TutorRequestSchema.safeParse(validRequest({ enunciado: "   " })).success, false);
  });

  it("rejeita questaoId que não é UUID", () => {
    assert.equal(TutorRequestSchema.safeParse(validRequest({ questaoId: "123" })).success, false);
  });

  it("rejeita resposta correta fora das alternativas", () => {
    const result = TutorRequestSchema.safeParse(validRequest({ respostaCorreta: "E" }));

    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues.map((issue) => issue.path[0]), ["respostaCorreta"]);
  });

  it("rejeita resposta do aluno fora das alternativas", () => {
    assert.equal(TutorRequestSchema.safeParse(validRequest({ respostaAluno: "Z" })).success, false);
  });

  it("rejeita letras de alternativa repetidas", () => {
    const alternativas = [
      { letra: "A", texto: "um" },
      { letra: "A", texto: "dois" },
    ];

    assert.equal(TutorRequestSchema.safeParse(validRequest({ alternativas, respostaCorreta: "A", respostaAluno: "A" })).success, false);
  });

  it("rejeita menos de duas alternativas", () => {
    const alternativas = [{ letra: "A", texto: "única" }];

    assert.equal(TutorRequestSchema.safeParse(validRequest({ alternativas, respostaCorreta: "A", respostaAluno: "A" })).success, false);
  });

  it("não aceita dados do aluno como campo extra no contrato (são descartados)", () => {
    const parsed = TutorRequestSchema.parse({ ...validRequest(), userId: "aluno-1", email: "a@b.c" });

    assert.equal("userId" in parsed, false);
    assert.equal("email" in parsed, false);
  });
});
