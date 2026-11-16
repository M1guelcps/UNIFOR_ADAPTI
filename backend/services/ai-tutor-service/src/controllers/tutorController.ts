import type { Request, Response } from "express";
import {
  TutorInvalidOutputError,
  TutorRateLimitedError,
  TutorUnavailableError,
} from "../domain/tutorErrors.js";
import { TutorRequestSchema } from "../schemas/tutorRequest.js";
import type { TutorService } from "../services/tutorService.js";

// Usado quando o provedor não informa quanto tempo esperar.
const DEFAULT_RETRY_AFTER_SECONDS = 30;

export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  explain = async (req: Request, res: Response) => {
    const validation = TutorRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Dados da questão inválidos.",
        details: validation.error.issues,
      });
    }

    try {
      const { feedback, cached } = await this.tutorService.explain(validation.data);

      return res.status(200).json({
        message: "Feedback pedagógico gerado com sucesso.",
        data: feedback,
        cached,
      });
    } catch (error: unknown) {
      return this.respondWithError(error, res);
    }
  };

  private respondWithError(error: unknown, res: Response) {
    console.error("[AI TUTOR ERROR]:", describeError(error));

    if (error instanceof TutorRateLimitedError) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS));
      return res.status(429).json({ error: "O tutor está com muitas solicitações. Tente novamente em instantes." });
    }

    if (error instanceof TutorInvalidOutputError) {
      return res.status(502).json({ error: "O tutor não conseguiu gerar uma explicação válida." });
    }

    if (error instanceof TutorUnavailableError) {
      return res.status(503).json({ error: "O tutor está indisponível no momento." });
    }

    return res.status(500).json({ error: "Não foi possível gerar o feedback." });
  }
}

// Registra nome, mensagem e o status HTTP do provedor (quando houver), sem despejar o objeto
// de erro inteiro: o erro original do SDK pode carregar detalhes da requisição.
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const cause = error.cause as { status?: unknown } | undefined;
  const providerStatus = typeof cause?.status === "number" ? ` (provedor: HTTP ${cause.status})` : "";
  return `${error.name}: ${error.message}${providerStatus}`;
}
