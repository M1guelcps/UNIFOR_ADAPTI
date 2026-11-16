/**
 * Erros definidos pela NECESSIDADE de quem chama (como tratar), não pela origem (Gemini, rede, Zod).
 * O controller mapeia cada um para um status HTTP e o Answer Service decide a mensagem ao aluno.
 */

/** Cota/limite do provedor de IA atingido. Quem chama deve tentar de novo mais tarde. */
export class TutorRateLimitedError extends Error {
  constructor(
    readonly retryAfterSeconds?: number,
    options?: ErrorOptions
  ) {
    super("Limite de requisições do provedor de IA atingido.", options);
    this.name = "TutorRateLimitedError";
  }
}

/** Provedor fora do ar, timeout ou rede. Também cobre chave/modelo mal configurados (erro nosso, não do aluno). */
export class TutorUnavailableError extends Error {
  constructor(message = "Provedor de IA indisponível.", options?: ErrorOptions) {
    super(message, options);
    this.name = "TutorUnavailableError";
  }
}

/** O provedor respondeu, mas o conteúdo não respeita o contrato (vazio, JSON inválido ou fora do schema). */
export class TutorInvalidOutputError extends Error {
  constructor(message = "O provedor de IA retornou um conteúdo inválido.", options?: ErrorOptions) {
    super(message, options);
    this.name = "TutorInvalidOutputError";
  }
}
