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
  constructor(
    private readonly model: TutorModel,
    private readonly repository: FeedbackRepository
  ) {}

  /**
   * Devolve a tutoria da questão: do cache quando existe, senão gerada pelo modelo e então guardada.
   * O cache é otimização, não requisito: se o banco falhar, a tutoria é entregue mesmo assim.
   * @throws TutorRateLimitedError | TutorUnavailableError | TutorInvalidOutputError
   */
  async explain(request: TutorRequest): Promise<ExplainResult> {
    const contentHash = computeContentHash(request);

    const stored = await this.findStoredFeedback(contentHash);
    if (stored) return { feedback: stored, cached: true };

    const generated = await this.generateValidFeedback(buildQuestionContent(request));
    const feedback = composeTutorResponse(request, generated);

    await this.storeFeedback(contentHash, request, feedback);
    return { feedback, cached: false };
  }

  private async findStoredFeedback(contentHash: string): Promise<TutorResponse | null> {
    try {
      return await this.repository.find(contentHash);
    } catch (error) {
      console.error("[TUTOR CACHE READ ERROR]:", describeError(error));
      return null;
    }
  }

  private async storeFeedback(contentHash: string, request: TutorRequest, feedback: TutorResponse): Promise<void> {
    try {
      await this.repository.save({
        contentHash,
        questaoId: request.questaoId,
        respostaAluno: request.respostaAluno,
        promptVersion: PROMPT_VERSION,
        model: this.model.name,
        feedback,
      });
    } catch (error) {
      console.error("[TUTOR CACHE WRITE ERROR]:", describeError(error));
    }
  }

  private async generateValidFeedback(content: string): Promise<ModelFeedback> {
    let lastError: TutorInvalidOutputError | undefined;

    for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS; attempt++) {
      try {
        return parseModelFeedback(await this.model.generateFeedback(content));
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
