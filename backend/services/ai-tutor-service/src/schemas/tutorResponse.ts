import { z } from "zod";

const Texto = z.string().trim().min(1);

const TituloEConteudo = z.object({ titulo: Texto, conteudo: Texto });

/**
 * O que o Gemini PRODUZ. Fica de fora tudo o que o servidor já sabe com certeza:
 * - `resultado` e a letra analisada: derivam de `respostaAluno === respostaCorreta`;
 * - `materiais`: só o catálogo do Adapti pode fornecer links.
 * Assim o modelo não tem como corrigir a questão nem inventar uma URL: o campo simplesmente não existe.
 */
export const ModelFeedbackSchema = z.object({
  explicacao: TituloEConteudo,
  analiseAluno: z.object({ conteudo: Texto }),
  contextualizacao: TituloEConteudo,
  recomendacoes: z.array(Texto).min(1).max(5),
});

export type ModelFeedback = z.infer<typeof ModelFeedbackSchema>;

const MaterialSchema = z.object({
  titulo: Texto,
  url: z.url(),
  descricao: Texto,
});

/** Contrato PÚBLICO devolvido ao Answer Service (mesmo formato descrito em docs/IaPlanServico). */
export const TutorResponseSchema = z.object({
  resultado: z.enum(["correto", "incorreto"]),
  explicacao: TituloEConteudo,
  analiseAluno: z.object({ alternativa: z.string().min(1), conteudo: Texto }),
  contextualizacao: TituloEConteudo,
  recomendacoes: z.array(Texto),
  materiais: z.array(MaterialSchema),
});

export type TutorResponse = z.infer<typeof TutorResponseSchema>;

/**
 * JSON Schema enviado ao Gemini, gerado a partir do mesmo Zod que valida a saída (fonte única).
 *
 * CUIDADO: o Gemini aceita só um subconjunto de JSON Schema; `$schema` é removido por precaução.
 * Se a API real rejeitar outra palavra-chave, ajuste AQUI e documente no teste de aprendizado.
 */
export function buildModelResponseJsonSchema(): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(ModelFeedbackSchema) as Record<string, unknown>;
  return schema;
}
