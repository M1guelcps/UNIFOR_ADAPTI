import type { TutorResponse } from "../schemas/tutorResponse.js";

export interface FeedbackEntry {
  contentHash: string;
  questaoId: string;
  respostaAluno: string;
  promptVersion: string;
  model: string;
  feedback: TutorResponse;
  /** Assuntos do catálogo escolhidos pelo modelo; os materiais são resolvidos a partir deles a cada resposta. */
  assuntos: string[];
}

/** Tutoria guardada: o texto gerado e os assuntos escolhidos (nunca os links, que vêm do catálogo na hora). */
export interface StoredFeedback {
  feedback: TutorResponse;
  assuntos: string[];
}

/** Porta de persistência do cache de tutorias. */
export interface FeedbackRepository {
  /** Devolve a tutoria guardada ou `null` quando não há (ou quando o registro guardado ficou inválido). */
  find(contentHash: string): Promise<StoredFeedback | null>;

  /** Idempotente: gravar duas vezes o mesmo `contentHash` não falha nem duplica. */
  save(entry: FeedbackEntry): Promise<void>;
}
