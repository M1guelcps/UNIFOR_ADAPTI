/** Tokens consumidos por uma chamada (todos opcionais: nem todo provedor/modelo informa). */
export interface ModelUsage {
  promptTokens?: number;
  outputTokens?: number;
  thoughtsTokens?: number;
  totalTokens?: number;
}

/** Resultado bruto de uma chamada ao modelo. */
export interface ModelCompletion {
  /** JSON já parseado, mas NÃO validado (quem chama valida com Zod). */
  data: unknown;
  /** Modelo que de fato respondeu: pode ser o reserva, quando o principal estava fora do ar. */
  model: string;
  usage: ModelUsage;
}

/**
 * Porta para o modelo de linguagem. O domínio depende desta interface, não do SDK do Gemini
 * (DIP): trocar de provedor ou testar sem rede é só passar outra implementação.
 */
export interface TutorModel {
  /** Identificador do modelo principal. */
  readonly name: string;

  /**
   * Gera o feedback bruto para o conteúdo da questão.
   * Pré-condição: `content` já foi montado por buildQuestionContent.
   * @throws TutorRateLimitedError | TutorUnavailableError | TutorInvalidOutputError
   */
  generateFeedback(content: string): Promise<ModelCompletion>;
}
