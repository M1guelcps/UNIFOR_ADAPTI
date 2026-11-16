import { TutorRateLimitedError } from "../domain/tutorErrors.js";
import { ConcurrencyLimiter, QueueFullError } from "../lib/concurrencyLimiter.js";
import type { ModelCompletion, TutorModel } from "../ports/tutorModel.js";

// Sugestão ao Answer Service quando a fila está cheia: o tutor se recupera em segundos.
const QUEUE_FULL_RETRY_AFTER_SECONDS = 5;

/**
 * Decorator que limita as chamadas simultâneas a qualquer TutorModel, para proteger a cota do Gemini.
 * Com a fila cheia, falha rápido com TutorRateLimitedError (HTTP 429 + Retry-After) em vez de
 * deixar o aluno esperando além do timeout.
 */
export class LimitedTutorModel implements TutorModel {
  constructor(
    private readonly inner: TutorModel,
    private readonly limiter: ConcurrencyLimiter
  ) {}

  get name(): string {
    return this.inner.name;
  }

  async generateFeedback(content: string): Promise<ModelCompletion> {
    try {
      return await this.limiter.run(() => this.inner.generateFeedback(content));
    } catch (error) {
      if (error instanceof QueueFullError) {
        throw new TutorRateLimitedError(QUEUE_FULL_RETRY_AFTER_SECONDS, { cause: error });
      }
      throw error;
    }
  }
}
