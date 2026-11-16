/**
 * Contrato do AI Tutor Service (backend/services/ai-tutor-service/src/schemas).
 * É duplicado aqui de propósito: microsserviços não compartilham código, só contratos HTTP.
 * Se mudar lá, mude aqui — o teste do cliente fixa o formato esperado.
 */

export interface TutorAlternativa {
  letra: string;
  texto: string;
}

export interface TutorRequestPayload {
  questaoId: string;
  enunciado: string;
  alternativas: TutorAlternativa[];
  respostaCorreta: string;
  respostaAluno: string;
  disciplina?: string;
  fonte?: string;
}

export interface TutorFeedback {
  resultado: "correto" | "incorreto";
  explicacao: { titulo: string; conteudo: string };
  analiseAluno: { alternativa: string; conteudo: string };
  contextualizacao: { titulo: string; conteudo: string };
  recomendacoes: string[];
  materiais: Array<{ titulo: string; url: string; descricao: string }>;
}

export interface TutorFeedbackResult {
  feedback: TutorFeedback;
  /** true quando o tutor reaproveitou uma explicação já gerada (nenhuma chamada nova ao Gemini). */
  cached: boolean;
}

/** Texto enviado no lugar de uma alternativa que só tem imagem; o prompt do tutor reconhece este texto. */
export const ALTERNATIVA_EM_IMAGEM = "[alternativa em imagem — conteúdo indisponível]";
