import { createHash } from "node:crypto";
import { PROMPT_VERSION } from "../prompts/tutorPrompt.js";
import type { TutorRequest } from "../schemas/tutorRequest.js";

/**
 * Chave do cache: sha256 de tudo o que influencia o texto gerado (versão do prompt + dados da questão
 * + alternativa marcada). Não usa questaoId: duas questões idênticas compartilham a mesma tutoria e,
 * se o professor editar o enunciado, o hash muda e a explicação antiga deixa de ser servida.
 *
 * A serialização é montada campo a campo (ordem fixa) para o hash ser estável.
 */
export function computeContentHash(request: TutorRequest): string {
  const canonical = JSON.stringify([
    PROMPT_VERSION,
    request.enunciado,
    request.alternativas.map((alternativa) => [alternativa.letra, alternativa.texto]),
    request.respostaCorreta,
    request.respostaAluno,
    request.disciplina ?? null,
    request.fonte ?? null,
  ]);

  return createHash("sha256").update(canonical).digest("hex");
}
