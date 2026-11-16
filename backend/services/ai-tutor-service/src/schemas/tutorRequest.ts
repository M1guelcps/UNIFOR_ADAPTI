import { z } from "zod";

const LetterSchema = z.string().trim().toUpperCase().regex(/^[A-Z]$/, "Use uma única letra (A–Z).");

const AlternativaSchema = z.object({
  letra: LetterSchema,
  texto: z.string().trim().min(1).max(5_000),
});

/**
 * Contrato entre o Answer Service e o AI Tutor Service.
 *
 * As alternativas são um ARRAY ordenado (não um Record) porque é assim que o quest-service as guarda
 * (`[{letter, text}]`) e a ordem é parte do enunciado. Não há userId nem answerId aqui de propósito:
 * nenhum dado do aluno deve chegar ao Gemini (o plano gratuito pode usar os dados para treino).
 */
export const TutorRequestSchema = z
  .object({
    questaoId: z.uuid(),
    enunciado: z.string().trim().min(1).max(20_000),
    alternativas: z.array(AlternativaSchema).min(2).max(5),
    respostaCorreta: LetterSchema,
    respostaAluno: LetterSchema,
    disciplina: z.string().trim().min(1).max(200).optional(),
    fonte: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((request, ctx) => {
    const letras = request.alternativas.map((alternativa) => alternativa.letra);

    if (new Set(letras).size !== letras.length) {
      ctx.addIssue({ code: "custom", path: ["alternativas"], message: "As letras das alternativas devem ser únicas." });
    }
    if (!letras.includes(request.respostaCorreta)) {
      ctx.addIssue({ code: "custom", path: ["respostaCorreta"], message: "A resposta correta não está entre as alternativas." });
    }
    if (!letras.includes(request.respostaAluno)) {
      ctx.addIssue({ code: "custom", path: ["respostaAluno"], message: "A resposta do aluno não está entre as alternativas." });
    }
  });

export type TutorRequest = z.infer<typeof TutorRequestSchema>;
