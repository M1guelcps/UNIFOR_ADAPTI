import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALTERNATIVA_EM_IMAGEM } from "../lib/aiTutorContract.js";
import { TutorQuestionInvalidError } from "../lib/tutorErrors.js";
import { toTutorRequest } from "./tutorRequestMapper.js";
import type { QuestForTutor } from "./tutorRequestMapper.js";

function quest(overrides: Partial<QuestForTutor> = {}): QuestForTutor {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    statement: "  Qual é a principal função de um banco de dados?  ",
    options: [
      { letter: "A", text: "Executar sistemas operacionais" },
      { letter: "B", text: "Armazenar e organizar informações" },
      { letter: "C", text: "Compilar códigos" },
    ],
    correctOption: "B",
    area: "Banco de Dados",
    source: "ENEM 2022",
    ...overrides,
  };
}

describe("toTutorRequest", () => {
  it("converte a questão do banco para o contrato do tutor", () => {
    const payload = toTutorRequest(quest(), "C");

    assert.deepEqual(payload, {
      questaoId: "550e8400-e29b-41d4-a716-446655440000",
      enunciado: "Qual é a principal função de um banco de dados?",
      alternativas: [
        { letra: "A", texto: "Executar sistemas operacionais" },
        { letra: "B", texto: "Armazenar e organizar informações" },
        { letra: "C", texto: "Compilar códigos" },
      ],
      respostaCorreta: "B",
      respostaAluno: "C",
      disciplina: "Banco de Dados",
      fonte: "ENEM 2022",
    });
  });

  it("omite disciplina e fonte quando a questão não tem esses dados", () => {
    const payload = toTutorRequest(quest({ area: null, source: "  " }), "C");

    assert.equal("disciplina" in payload, false);
    assert.equal("fonte" in payload, false);
  });

  it("aceita alternativas como texto puro, atribuindo as letras A, B, C...", () => {
    const payload = toTutorRequest(quest({ options: ["um", "dois", "três"] }), "A");

    assert.deepEqual(payload.alternativas.map((alternativa) => alternativa.letra), ["A", "B", "C"]);
  });

  it("aceita os campos description e body vindos da importação do ENEM", () => {
    const options = [
      { letter: "A", description: "texto via description" },
      { letter: "B", body: "texto via body" },
    ];

    const payload = toTutorRequest(quest({ options }), "A");

    assert.deepEqual(payload.alternativas.map((alternativa) => alternativa.texto), ["texto via description", "texto via body"]);
  });

  it("sinaliza alternativa que só tem imagem para o tutor declarar a limitação", () => {
    const options = [
      { letter: "A", text: "com texto" },
      { letter: "B", file: "https://exemplo.com/figura.png" },
    ];

    const payload = toTutorRequest(quest({ options }), "A");

    assert.equal(payload.alternativas[1]?.texto, ALTERNATIVA_EM_IMAGEM);
  });

  it("normaliza letras minúsculas do gabarito e da resposta", () => {
    const payload = toTutorRequest(quest({ correctOption: "b" }), "c");

    assert.equal(payload.respostaCorreta, "B");
    assert.equal(payload.respostaAluno, "C");
  });

  it("rejeita o gabarito 'Não definida' da importação do ENEM", () => {
    assert.throws(() => toTutorRequest(quest({ correctOption: "Não definida" }), "A"), TutorQuestionInvalidError);
  });

  it("rejeita questão cujas alternativas não são uma lista", () => {
    assert.throws(() => toTutorRequest(quest({ options: {} }), "A"), TutorQuestionInvalidError);
  });

  it("rejeita questão com menos de duas ou mais de cinco alternativas", () => {
    assert.throws(() => toTutorRequest(quest({ options: [{ letter: "A", text: "só uma" }], correctOption: "A" }), "A"), TutorQuestionInvalidError);

    const seis = ["A", "B", "C", "D", "E", "F"].map((letter) => ({ letter, text: `opção ${letter}` }));
    assert.throws(() => toTutorRequest(quest({ options: seis, correctOption: "A" }), "A"), TutorQuestionInvalidError);
  });

  it("rejeita alternativa marcada que não existe na questão", () => {
    assert.throws(() => toTutorRequest(quest(), "Z"), TutorQuestionInvalidError);
  });

  it("rejeita enunciado vazio", () => {
    assert.throws(() => toTutorRequest(quest({ statement: "   " }), "A"), TutorQuestionInvalidError);
  });
});
