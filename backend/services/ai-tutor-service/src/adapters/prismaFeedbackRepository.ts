import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { FeedbackEntry, FeedbackRepository } from "../ports/feedbackRepository.js";
import { TutorResponseSchema } from "../schemas/tutorResponse.js";
import type { TutorResponse } from "../schemas/tutorResponse.js";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export class PrismaFeedbackRepository implements FeedbackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(contentHash: string): Promise<TutorResponse | null> {
    const row = await this.prisma.tutorFeedback.findUnique({ where: { contentHash } });
    if (!row) return null;

    // Se o formato público evoluiu desde que o registro foi gravado, trata como "não encontrado"
    // e a tutoria é gerada de novo, em vez de entregar um JSON fora do contrato.
    const parsed = TutorResponseSchema.safeParse(row.feedback);
    return parsed.success ? parsed.data : null;
  }

  async save(entry: FeedbackEntry): Promise<void> {
    try {
      await this.prisma.tutorFeedback.create({
        data: {
          contentHash: entry.contentHash,
          questaoId: entry.questaoId,
          respostaAluno: entry.respostaAluno,
          promptVersion: entry.promptVersion,
          model: entry.model,
          feedback: entry.feedback,
        },
      });
    } catch (error) {
      // Duas requisições para a mesma tutoria geraram ao mesmo tempo: a outra já gravou, o resultado é o mesmo.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION) {
        return;
      }
      throw error;
    }
  }
}
