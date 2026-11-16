import { createHash } from "node:crypto";
import { PROMPT_VERSION, TUTOR_SYSTEM_PROMPT } from "../prompts/tutorPrompt.js";
import type { TutorRequest } from "../schemas/tutorRequest.js";
import { buildModelResponseJsonSchema } from "../schemas/tutorResponse.js";

/**
 * Impressão digital do que instrui o modelo: texto do prompt + JSON Schema da resposta.
 * Se alguém editar o prompt e esquecer de incrementar PROMPT_VERSION, o hash muda do mesmo jeito
 * e as explicações antigas deixam de ser servidas.
 */
export function computePromptFingerprint(systemPrompt: string, responseSchema: unknown): string {
  return createHash("sha256").update(JSON.stringify([systemPrompt, responseSchema])).digest("hex");
}

export const PROMPT_FINGERPRINT = computePromptFingerprint(TUTOR_SYSTEM_PROMPT, buildModelResponseJsonSchema());

/**
 * Chave do cache: sha256 de tudo o que influencia o texto gerado (versão e impressão digital do prompt
 * + dados da questão + alternativa marcada). Não usa questaoId: duas questões idênticas compartilham a
 * mesma tutoria e, se o professor editar o enunciado, o hash muda e a explicação antiga deixa de ser servida.
 *
 * A serialização é montada campo a campo (ordem fixa) para o hash ser estável.
 */
export function computeContentHash(request: TutorRequest): string {
  const canonical = JSON.stringify([
    PROMPT_VERSION,
    PROMPT_FINGERPRINT,
    request.enunciado,
    request.alternativas.map((alternativa) => [alternativa.letra, alternativa.texto]),
    request.respostaCorreta,
    request.respostaAluno,
    request.disciplina ?? null,
    request.fonte ?? null,
  ]);

  return createHash("sha256").update(canonical).digest("hex");
}
