/**
 * Erros do fluxo "explicação do tutor". São definidos pelo que o controller precisa decidir
 * (qual status HTTP e qual mensagem mostrar ao aluno), não pela origem da falha.
 */

/** A resposta não existe ou pertence a outro usuário (os dois casos são indistinguíveis de propósito). */
export class AnswerNotFoundError extends Error {
  constructor() {
    super("Resposta não encontrada.");
    this.name = "AnswerNotFoundError";
  }
}

/** A questão não tem dados suficientes para o tutor explicar (ex.: gabarito "Não definida" vindo da importação). */
export class TutorQuestionInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TutorQuestionInvalidError";
  }
}

/** O AI Tutor Service (ou o Gemini por trás dele) pediu para esperar antes de tentar de novo. */
export class TutorRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds?: number) {
    super("O tutor atingiu o limite de solicitações.");
    this.name = "TutorRateLimitedError";
  }
}

/** O tutor está fora do ar, mal configurado ou respondeu algo ilegível. A resposta do aluno continua registrada. */
export class TutorUnavailableError extends Error {
  constructor(message = "O tutor está indisponível.", options?: ErrorOptions) {
    super(message, options);
    this.name = "TutorUnavailableError";
  }
}
