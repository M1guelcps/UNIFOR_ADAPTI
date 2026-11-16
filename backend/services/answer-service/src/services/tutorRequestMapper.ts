import { ALTERNATIVA_EM_IMAGEM } from "../lib/aiTutorContract.js";
import type { TutorAlternativa, TutorRequestPayload } from "../lib/aiTutorContract.js";
import { TutorQuestionInvalidError } from "../lib/tutorErrors.js";

/** Subconjunto de Quest que o tutor precisa. `options` é Json no Prisma: pode vir em vários formatos. */
export interface QuestForTutor {
  id: string;
  statement: string;
  options: unknown;
  correctOption: string;
  area: string | null;
  source: string | null;
}

const LETRAS = ["A", "B", "C", "D", "E"];
const MIN_ALTERNATIVAS = 2;
const MAX_ALTERNATIVAS = 5;
const MAX_ENUNCIADO = 20_000;
const ALTERNATIVA_SEM_TEXTO = "[alternativa sem texto]";

/**
 * Converte a questão e a alternativa marcada no payload do tutor.
 * Função pura: valida aqui (e não deixa o tutor responder 400) para dar ao aluno uma mensagem útil
 * quando a questão não tem gabarito utilizável, como acontece com "Não definida" na importação do ENEM.
 *
 * @throws TutorQuestionInvalidError quando a questão não permite gerar uma explicação confiável.
 */
export function toTutorRequest(quest: QuestForTutor, selectedOption: string): TutorRequestPayload {
  const enunciado = quest.statement.trim();
  const alternativas = normalizeAlternativas(quest.options);
  const respostaCorreta = quest.correctOption.trim().toUpperCase();
  const respostaAluno = selectedOption.trim().toUpperCase();

  assertTutorable({ enunciado, alternativas, respostaCorreta, respostaAluno });

  return {
    questaoId: quest.id,
    enunciado,
    alternativas,
    respostaCorreta,
    respostaAluno,
    ...optionalText("disciplina", quest.area),
    ...optionalText("fonte", quest.source),
  };
}

/**
 * Aceita os formatos que existem no banco (mesma tolerância do frontend, normalizarOpcoes):
 * texto puro, ou objeto com letter + text/description/body e, opcionalmente, file (URL de imagem).
 */
function normalizeAlternativas(options: unknown): TutorAlternativa[] {
  if (!Array.isArray(options)) return [];

  return options.map((option, index): TutorAlternativa => {
    if (typeof option === "string") {
      return { letra: LETRAS[index] ?? String(index + 1), texto: option.trim() || ALTERNATIVA_SEM_TEXTO };
    }

    const raw = (option ?? {}) as Record<string, unknown>;
    const letra = String(raw.letter ?? LETRAS[index] ?? index + 1).trim().toUpperCase();
    const texto = firstText(raw.text, raw.description, raw.body);
    const temImagem = typeof raw.file === "string" && raw.file.length > 0;

    return { letra, texto: texto ?? (temImagem ? ALTERNATIVA_EM_IMAGEM : ALTERNATIVA_SEM_TEXTO) };
  });
}

function assertTutorable(data: {
  enunciado: string;
  alternativas: TutorAlternativa[];
  respostaCorreta: string;
  respostaAluno: string;
}): void {
  const letras = data.alternativas.map((alternativa) => alternativa.letra);

  if (!data.enunciado || data.enunciado.length > MAX_ENUNCIADO) {
    throw new TutorQuestionInvalidError("O enunciado desta questão não permite gerar uma explicação.");
  }
  if (data.alternativas.length < MIN_ALTERNATIVAS || data.alternativas.length > MAX_ALTERNATIVAS || new Set(letras).size !== letras.length) {
    throw new TutorQuestionInvalidError("As alternativas desta questão não permitem gerar uma explicação.");
  }
  if (!letras.includes(data.respostaCorreta)) {
    throw new TutorQuestionInvalidError("Esta questão não possui um gabarito válido, então não é possível gerar a explicação.");
  }
  if (!letras.includes(data.respostaAluno)) {
    throw new TutorQuestionInvalidError("A alternativa marcada não existe nesta questão.");
  }
}

function firstText(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function optionalText<K extends string>(key: K, value: string | null): Partial<Record<K, string>> {
  const text = value?.trim();
  return text ? ({ [key]: text } as Record<K, string>) : {};
}
