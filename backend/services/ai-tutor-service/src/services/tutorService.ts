import { computeContentHash } from "../domain/contentHash.js";
import { TutorInvalidOutputError } from "../domain/tutorErrors.js";
import type { FeedbackRepository } from "../ports/feedbackRepository.js";
import type { TutorModel } from "../ports/tutorModel.js";
import { PROMPT_VERSION, buildQuestionContent } from "../prompts/tutorPrompt.js";
import type { TutorRequest } from "../schemas/tutorRequest.js";
import { ModelFeedbackSchema } from "../schemas/tutorResponse.js";
import type { ModelFeedback, TutorResponse } from "../schemas/tutorResponse.js";

export interface ExplainResult {
  feedback: TutorResponse;
  /** true quando veio do cache (nenhuma chamada ao Gemini foi feita). */
  cached: boolean;
}

// Saída inválida costuma ser pontual (o modelo não é determinístico): uma segunda chance basta.
// Limite de cota (429) NÃO é repetido aqui: backoff síncrono só alongaria a espera do aluno.
const MAX_MODEL_ATTEMPTS = 2;

export class TutorService {
  // Gerações em andamento por hash: pedidos idênticos simultâneos esperam a mesma chamada ao Gemini.
  private readonly inFlight = new Map<string, Promise<TutorResponse>>();

  constructor(
    private readonly model: TutorModel,
    private readonly repository: FeedbackRepository
  ) {}

  /**
   * Devolve a tutoria da questão: do cache quando existe, senão gerada pelo modelo e então guardada.
   * O cache é otimização, não requisito: se o banco falhar, a tutoria é entregue mesmo assim.
   * Pedidos idênticos que chegam enquanto o primeiro ainda gera compartilham a mesma chamada (cached: true).
   * @throws TutorRateLimitedError | TutorUnavailableError | TutorInvalidOutputError
   */
  async explain(request: TutorRequest): Promise<ExplainResult> {
    const contentHash = computeContentHash(request);

    const pending = this.inFlight.get(contentHash);
    if (pending) return { feedback: await pending, cached: true };

    const stored = await this.findStoredFeedback(contentHash);
    if (stored) return { feedback: stored, cached: true };

    // Depois do último await acima não há brecha: quem chegar a seguir encontra a geração registrada.
    const racing = this.inFlight.get(contentHash);
    if (racing) return { feedback: await racing, cached: true };

    const generation = this.generateAndStore(contentHash, request);
    this.inFlight.set(contentHash, generation);
    try {
      return { feedback: await generation, cached: false };
    } finally {
      this.inFlight.delete(contentHash);
    }
  }

  private async generateAndStore(contentHash: string, request: TutorRequest): Promise<TutorResponse> {
    const { generated, model } = await this.generateValidFeedback(buildQuestionContent(request));
    const feedback = composeTutorResponse(request, generated);

    await this.storeFeedback(contentHash, request, feedback, model);
    return feedback;
  }

  private async findStoredFeedback(contentHash: string): Promise<TutorResponse | null> {
    try {
      return await this.repository.find(contentHash);
    } catch (error) {
      console.error("[TUTOR CACHE READ ERROR]:", describeError(error));
      return null;
    }
  }

  private async storeFeedback(contentHash: string, request: TutorRequest, feedback: TutorResponse, model: string): Promise<void> {
    try {
      await this.repository.save({
        contentHash,
        questaoId: request.questaoId,
        respostaAluno: request.respostaAluno,
        promptVersion: PROMPT_VERSION,
        // O modelo que de fato respondeu (pode ser o reserva), não o configurado como principal.
        model,
        feedback,
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
 * nunca do modelo, e `materiais` é sempre vazio até existir o catálogo do Adapti.
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

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
