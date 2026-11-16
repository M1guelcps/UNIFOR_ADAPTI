/**
 * Porta para o modelo de linguagem. O domínio depende desta interface, não do SDK do Gemini
 * (DIP): trocar de provedor ou testar sem rede é só passar outra implementação.
 */
export interface TutorModel {
  /** Identificador do modelo, gravado junto do feedback para auditoria. */
  readonly name: string;

  /**
   * Gera o feedback bruto para o conteúdo da questão.
   * Pré-condição: `content` já foi montado por buildQuestionContent.
   * Pós-condição: devolve o JSON já parseado, mas NÃO validado (quem chama valida com Zod).
   * @throws TutorRateLimitedError | TutorUnavailableError | TutorInvalidOutputError
   */
  generateFeedback(content: string): Promise<unknown>;
}
