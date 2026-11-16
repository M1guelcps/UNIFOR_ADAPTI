import type { TutorResponse } from "../schemas/tutorResponse.js";

export interface FeedbackEntry {
  contentHash: string;
  questaoId: string;
  respostaAluno: string;
  promptVersion: string;
  model: string;
  feedback: TutorResponse;
}

/** Porta de persistência do cache de tutorias. */
export interface FeedbackRepository {
  /** Devolve o feedback guardado ou `null` quando não há (ou quando o registro guardado ficou inválido). */
  find(contentHash: string): Promise<TutorResponse | null>;

  /** Idempotente: gravar duas vezes o mesmo `contentHash` não falha nem duplica. */
  save(entry: FeedbackEntry): Promise<void>;
}
