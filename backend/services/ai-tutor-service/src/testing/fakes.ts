import type { FeedbackEntry, FeedbackRepository } from "../ports/feedbackRepository.js";
import type { ModelCompletion, TutorModel } from "../ports/tutorModel.js";
import type { TutorRequest } from "../schemas/tutorRequest.js";
import type { TutorResponse } from "../schemas/tutorResponse.js";

export const QUESTAO_ID = "550e8400-e29b-41d4-a716-446655440000";

/** Questão do exemplo do doc (banco de dados), aluno errou: marcou C, correta é B. */
export function validRequest(overrides: Partial<TutorRequest> = {}): TutorRequest {
  return {
    questaoId: QUESTAO_ID,
    enunciado: "Qual é a principal função de um banco de dados?",
    alternativas: [
      { letra: "A", texto: "Executar sistemas operacionais" },
      { letra: "B", texto: "Armazenar e organizar informações" },
      { letra: "C", texto: "Compilar códigos" },
      { letra: "D", texto: "Gerenciar componentes físicos" },
    ],
    respostaCorreta: "B",
    respostaAluno: "C",
    disciplina: "Banco de Dados",
    ...overrides,
  };
}

/** O que o Gemini devolveria (sem resultado, sem letra, sem materiais). */
export function validModelOutput() {
  return {
    explicacao: { titulo: "Por que a B está correta?", conteudo: "Um banco de dados armazena e organiza informações." },
    analiseAluno: { conteudo: "Compilar código é tarefa de um compilador." },
    contextualizacao: { titulo: "Entendendo bancos de dados", conteudo: "Usados em sistemas bancários e acadêmicos." },
    recomendacoes: ["Estudar fundamentos de bancos de dados", "Aprender SQL"],
  };
}

/** Modelo roteirizado: cada chamada consome o próximo item; um Error é lançado em vez de devolvido. */
export class FakeTutorModel implements TutorModel {
  readonly name = "fake-model";
  readonly contents: string[] = [];
  private readonly script: Array<unknown>;

  constructor(...script: Array<unknown>) {
    this.script = [...script];
  }

  get calls(): number {
    return this.contents.length;
  }

  async generateFeedback(content: string): Promise<ModelCompletion> {
    this.contents.push(content);
    const next = this.script.shift();
    if (next === undefined) throw new Error("FakeTutorModel sem resposta roteirizada.");
    if (next instanceof Error) throw next;
    return { data: next, model: this.name, usage: {} };
  }
}

export class InMemoryFeedbackRepository implements FeedbackRepository {
  readonly entries = new Map<string, FeedbackEntry>();
  failOnFind = false;
  failOnSave = false;

  async find(contentHash: string): Promise<TutorResponse | null> {
    if (this.failOnFind) throw new Error("banco indisponível (find)");
    return this.entries.get(contentHash)?.feedback ?? null;
  }

  async save(entry: FeedbackEntry): Promise<void> {
    if (this.failOnSave) throw new Error("banco indisponível (save)");
    this.entries.set(entry.contentHash, entry);
  }
}
