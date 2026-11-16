import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { FeedbackEntry, FeedbackRepository, StoredFeedback } from "../ports/feedbackRepository.js";
import { TutorResponseSchema } from "../schemas/tutorResponse.js";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

const AssuntosSchema = z.array(z.string());

export class PrismaFeedbackRepository implements FeedbackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(contentHash: string): Promise<StoredFeedback | null> {
    const row = await this.prisma.tutorFeedback.findUnique({ where: { contentHash } });
    if (!row) return null;

    // Se o formato público evoluiu desde que o registro foi gravado, trata como "não encontrado"
    // e a tutoria é gerada de novo, em vez de entregar um JSON fora do contrato.
    const parsed = TutorResponseSchema.safeParse(row.feedback);
    if (!parsed.success) return null;

    // Linhas gravadas antes do catálogo têm assuntos nulo: valem como "nenhum assunto".
    const assuntos = AssuntosSchema.safeParse(row.assuntos);
    return { feedback: parsed.data, assuntos: assuntos.success ? assuntos.data : [] };
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
          assuntos: entry.assuntos,
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
