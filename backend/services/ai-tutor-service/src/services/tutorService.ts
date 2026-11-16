import { computeContentHash } from "../domain/contentHash.js";
import { normalizeKey } from "../domain/normalizeKey.js";
import { TutorInvalidOutputError } from "../domain/tutorErrors.js";
import type { FeedbackRepository } from "../ports/feedbackRepository.js";
import type { MaterialCatalog } from "../ports/materialCatalog.js";
import type { TutorModel } from "../ports/tutorModel.js";
import { PROMPT_VERSION, buildQuestionContent } from "../prompts/tutorPrompt.js";
import type { TutorRequest } from "../schemas/tutorRequest.js";
import { ModelFeedbackSchema } from "../schemas/tutorResponse.js";
import type { Material, ModelFeedback, TutorResponse } from "../schemas/tutorResponse.js";

export interface ExplainResult {
  feedback: TutorResponse;
  /** true quando a tutoria veio do cache ou de uma geração já em andamento (nenhuma chamada nova ao Gemini). */
  cached: boolean;
}

/** O que é gerado, guardado e compartilhado: o texto e os assuntos escolhidos. Os links nunca fazem parte. */
interface Tutoria {
  feedback: TutorResponse;
  assuntos: string[];
}

// Saída inválida costuma ser pontual (o modelo não é determinístico): uma segunda chance basta.
// Limite de cota (429) NÃO é repetido aqui: backoff síncrono só alongaria a espera do aluno.
const MAX_MODEL_ATTEMPTS = 2;

const MAX_TOPICS_PER_TUTORIA = 3;
const MAX_MATERIALS = 5;

export class TutorService {
  // Gerações em andamento por hash: pedidos idênticos simultâneos esperam a mesma chamada ao Gemini.
  private readonly inFlight = new Map<string, Promise<Tutoria>>();

  /** `catalog` é opcional: sem ele a resposta sai com `materiais: []`, como antes do catálogo existir. */
  constructor(
    private readonly model: TutorModel,
    private readonly repository: FeedbackRepository,
    private readonly catalog?: MaterialCatalog
  ) {}

  /**
   * Devolve a tutoria da questão: do cache quando existe, senão gerada pelo modelo e então guardada.
   * O cache é otimização, não requisito: se o banco falhar, a tutoria é entregue mesmo assim.
   * Pedidos idênticos que chegam enquanto o primeiro ainda gera compartilham a mesma chamada (cached: true).
   *
   * Os `materiais` NUNCA vêm do modelo nem do cache: são buscados no catálogo a cada resposta, a partir dos
   * assuntos escolhidos. Assim um material novo aparece sem gerar a tutoria de novo, e um removido some.
   * @throws TutorRateLimitedError | TutorUnavailableError | TutorInvalidOutputError
   */
  async explain(request: TutorRequest): Promise<ExplainResult> {
    const assuntosDoCatalogo = await this.listCatalogTopics(request.disciplina);
    const contentHash = computeContentHash(request, assuntosDoCatalogo);

    const { tutoria, cached } = await this.obtainTutoria(contentHash, request, assuntosDoCatalogo);
    const materiais = await this.findMaterials(request.disciplina, tutoria.assuntos);

    return { feedback: { ...tutoria.feedback, materiais }, cached };
  }

  private async obtainTutoria(
    contentHash: string,
    request: TutorRequest,
    assuntosDoCatalogo: string[]
  ): Promise<{ tutoria: Tutoria; cached: boolean }> {
    const pending = this.inFlight.get(contentHash);
    if (pending) return { tutoria: await pending, cached: true };

    const stored = await this.findStoredFeedback(contentHash);
    if (stored) return { tutoria: stored, cached: true };

    // Depois do último await acima não há brecha: quem chegar a seguir encontra a geração registrada.
    const racing = this.inFlight.get(contentHash);
    if (racing) return { tutoria: await racing, cached: true };

    const generation = this.generateAndStore(contentHash, request, assuntosDoCatalogo);
    this.inFlight.set(contentHash, generation);
    try {
      return { tutoria: await generation, cached: false };
    } finally {
      this.inFlight.delete(contentHash);
    }
  }

  private async generateAndStore(contentHash: string, request: TutorRequest, assuntosDoCatalogo: string[]): Promise<Tutoria> {
    const { generated, model } = await this.generateValidFeedback(buildQuestionContent(request, assuntosDoCatalogo));
    const tutoria: Tutoria = {
      feedback: composeTutorResponse(request, generated),
      // O modelo só pode escolher o que a lista oferecia; qualquer outra coisa é descartada aqui.
      assuntos: selectCatalogTopics(generated.assuntos, assuntosDoCatalogo),
    };

    await this.storeFeedback(contentHash, request, tutoria, model);
    return tutoria;
  }

  private async listCatalogTopics(disciplina: string | undefined): Promise<string[]> {
    if (!this.catalog) return [];
    try {
      return await this.catalog.listTopics(disciplina);
    } catch (error) {
      console.error("[TUTOR CATALOG ERROR]:", describeError(error));
      return [];
    }
  }

  private async findMaterials(disciplina: string | undefined, assuntos: string[]): Promise<Material[]> {
    if (!this.catalog || assuntos.length === 0) return [];
    try {
      return await this.catalog.findMaterials(disciplina, assuntos, MAX_MATERIALS);
    } catch (error) {
      // O catálogo é enriquecimento: sem ele a tutoria sai completa, só que sem links.
      console.error("[TUTOR CATALOG ERROR]:", describeError(error));
      return [];
    }
  }

  private async findStoredFeedback(contentHash: string): Promise<Tutoria | null> {
    try {
      return await this.repository.find(contentHash);
    } catch (error) {
      console.error("[TUTOR CACHE READ ERROR]:", describeError(error));
      return null;
    }
  }

  private async storeFeedback(contentHash: string, request: TutorRequest, tutoria: Tutoria, model: string): Promise<void> {
    try {
      await this.repository.save({
        contentHash,
        questaoId: request.questaoId,
        respostaAluno: request.respostaAluno,
        promptVersion: PROMPT_VERSION,
        // O modelo que de fato respondeu (pode ser o reserva), não o configurado como principal.
        model,
        feedback: tutoria.feedback,
        assuntos: tutoria.assuntos,
      });
    } catch (error) {
      console.error("[TUTOR CACHE WRITE ERROR]:", describeError(error));
    }
  }

  private async generateValidFeedback(content: string): Promise<{ generated: ModelFeedback; model: string }> {
    let lastError: TutorInvalidOutputError | undefined;

    for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS; attempt++) {
      try {
        const completion = await this.model.generateFeedback(content);
        return { generated: parseModelFeedback(completion.data), model: completion.model };
      } catch (error) {
        if (!(error instanceof TutorInvalidOutputError)) throw error;
        lastError = error;
      }
    }

    throw lastError ?? new TutorInvalidOutputError();
  }
}

function parseModelFeedback(raw: unknown): ModelFeedback {
  const parsed = ModelFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TutorInvalidOutputError("O Gemini retornou um JSON fora do esquema esperado.", { cause: parsed.error });
  }
  return parsed.data;
}

/**
 * Monta a resposta pública. `resultado` e a letra analisada vêm da comparação feita AQUI,
 * nunca do modelo, e `materiais` sai vazio: só o catálogo os preenche, a cada resposta.
 */
function composeTutorResponse(request: TutorRequest, generated: ModelFeedback): TutorResponse {
  return {
    resultado: request.respostaAluno === request.respostaCorreta ? "correto" : "incorreto",
    explicacao: generated.explicacao,
    analiseAluno: { alternativa: request.respostaAluno, conteudo: generated.analiseAluno.conteudo },
    contextualizacao: generated.contextualizacao,
    recomendacoes: generated.recomendacoes,
    materiais: [],
  };
}

/**
 * Mantém só os assuntos que existem na lista oferecida (comparando sem acento nem caixa), já na grafia
 * do catálogo, sem repetição e até o limite. Tudo que o modelo inventar fica de fora.
 */
function selectCatalogTopics(requested: string[], available: string[]): string[] {
  const canonicalByKey = new Map(available.map((topic) => [normalizeKey(topic), topic]));
  const selected: string[] = [];

  for (const topic of requested) {
    const canonical = canonicalByKey.get(normalizeKey(topic));
    if (canonical && !selected.includes(canonical)) selected.push(canonical);
  }
  return selected.slice(0, MAX_TOPICS_PER_TUTORIA);
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
