import { normalizeKey } from "../domain/normalizeKey.js";
import type { FeedbackEntry, FeedbackRepository, StoredFeedback } from "../ports/feedbackRepository.js";
import type { MaterialCatalog } from "../ports/materialCatalog.js";
import type { ModelCompletion, TutorModel } from "../ports/tutorModel.js";
import type { TutorRequest } from "../schemas/tutorRequest.js";
import type { Material } from "../schemas/tutorResponse.js";

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
    assuntos: [] as string[],
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

  async find(contentHash: string): Promise<StoredFeedback | null> {
    if (this.failOnFind) throw new Error("banco indisponível (find)");
    const entry = this.entries.get(contentHash);
    return entry ? { feedback: entry.feedback, assuntos: entry.assuntos } : null;
  }

  async save(entry: FeedbackEntry): Promise<void> {
    if (this.failOnSave) throw new Error("banco indisponível (save)");
    this.entries.set(entry.contentHash, entry);
  }
}

export interface FakeCatalogMaterial extends Material {
  /** Disciplina em qualquer grafia: é normalizada na comparação, como no catálogo real. */
  disciplina: string;
  assunto: string;
}

/** Catálogo em memória com o mesmo contrato do real (disciplina normalizada, ordem estável, limite). */
export class InMemoryMaterialCatalog implements MaterialCatalog {
  failOnListTopics = false;
  failOnFindMaterials = false;
  findCalls = 0;

  constructor(private readonly materials: FakeCatalogMaterial[] = []) {}

  add(material: FakeCatalogMaterial): void {
    this.materials.push(material);
  }

  async listTopics(disciplina: string | undefined): Promise<string[]> {
    if (this.failOnListTopics) throw new Error("catálogo indisponível (listTopics)");
    if (!disciplina) return [];
    const subject = normalizeKey(disciplina);
    const topics = this.materials.filter((m) => normalizeKey(m.disciplina) === subject).map((m) => m.assunto);
    return [...new Set(topics)].sort();
  }

  async findMaterials(disciplina: string | undefined, assuntos: string[], limit: number): Promise<Material[]> {
    this.findCalls += 1;
    if (this.failOnFindMaterials) throw new Error("catálogo indisponível (findMaterials)");
    if (!disciplina) return [];
    const subject = normalizeKey(disciplina);
    return this.materials
      .filter((m) => normalizeKey(m.disciplina) === subject && assuntos.includes(m.assunto))
      .sort((a, b) => a.assunto.localeCompare(b.assunto) || a.titulo.localeCompare(b.titulo))
      .slice(0, limit)
      .map(({ titulo, url, descricao }) => ({ titulo, url, descricao }));
  }
}
