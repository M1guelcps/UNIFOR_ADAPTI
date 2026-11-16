/**
 * Avaliação do prompt contra o Gemini REAL, com o adapter e o TutorService de produção
 * (repositório em memória: não toca o banco).
 *
 *   npm run eval:prompt                        → roda as questões de fixtures/evalQuestions.json
 *   npm run eval:prompt -- q1 enem2022-142     → só essas questões
 *   npm run eval:prompt -- --compare results/resultados-v1.json results/resultados-v2.json
 *
 * Grava scripts/results/resultados-<PROMPT_VERSION>.json. As checagens automáticas são HEURÍSTICAS
 * (regex): servem para comparar versões do prompt, não substituem a leitura das respostas.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { GeminiTutorModel } from "../src/adapters/geminiTutorModel.js";
import { PROMPT_VERSION } from "../src/prompts/tutorPrompt.js";
import type { TutorRequest } from "../src/schemas/tutorRequest.js";
import type { TutorResponse } from "../src/schemas/tutorResponse.js";
import { TutorService } from "../src/services/tutorService.js";
import { InMemoryFeedbackRepository } from "../src/testing/fakes.js";

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = resolve(here, "results");

interface EvalQuestion {
  id: string;
  tag: string;
  area: string;
  source: string | null;
  statement: string;
  options: Array<{ letter: string; text: string }>;
  correctOption: string;
  chosen: string;
}

interface Checks {
  /** Letras dos distratores (≠ correta) que aparecem citadas no texto da tutoria. */
  distratoresCitados: string[];
  distratoresAusentes: string[];
  /** Ocorrências de "o autor"/"a autora" sem nome (a autoria deveria ser neutra). */
  autorSemNome: number;
  /** null = o enunciado traz uma pergunta (n/a); boolean = o modelo avisou que falta o comando. */
  avisouFaltaDeComando: boolean | null;
}

interface CaseResult {
  id: string;
  area: string;
  correctOption: string;
  chosen: string;
  ok: boolean;
  error?: string;
  ms: number;
  usage: Record<string, number | undefined>;
  feedback?: TutorResponse;
  checks?: Checks;
}

interface ResultFile {
  promptVersion: string;
  model: string;
  generatedAt: string;
  cases: CaseResult[];
}

function allText(feedback: TutorResponse): string {
  return [
    feedback.explicacao.titulo,
    feedback.explicacao.conteudo,
    feedback.analiseAluno.conteudo,
    feedback.contextualizacao.titulo,
    feedback.contextualizacao.conteudo,
    ...feedback.recomendacoes,
  ].join("\n");
}

function letterIsCited(text: string, letter: string): boolean {
  const patterns = [
    new RegExp(`\\(${letter}\\)`),
    new RegExp(`(^|[^A-Za-zÀ-ÿ])${letter}\\)`),
    new RegExp(`(alternativas?|letras?|itens?|opç(?:ão|ões))[^.\\n]{0,40}(?<![A-Za-zÀ-ÿ])${letter}(?![A-Za-zÀ-ÿ])`, "i"),
    new RegExp(`\\*\\*${letter}\\*\\*`),
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function runChecks(question: EvalQuestion, feedback: TutorResponse): Checks {
  const text = allText(feedback);
  const distratores = question.options.map((o) => o.letter).filter((l) => l !== question.correctOption);
  const cited = distratores.filter((l) => letterIsCited(text, l));

  const semComando = !question.statement.includes("?");
  const avisouFalta =
    /(enunciado|texto|quest[ãa]o)[^.\n]{0,80}(n[ãa]o (traz|apresenta|informa|inclui|cont[ée]m|h[áa])|sem)[^.\n]{0,60}(pergunta|comando)/i.test(text) ||
    /pergunta[^.\n]{0,60}(dedu[zç]|infer|subentend|entend)/i.test(text);

  return {
    distratoresCitados: cited,
    distratoresAusentes: distratores.filter((l) => !cited.includes(l)),
    autorSemNome: (text.match(/\b(o|a)\s+autor(a)?\b/gi) ?? []).length,
    avisouFaltaDeComando: semComando ? avisouFalta : null,
  };
}

function toRequest(question: EvalQuestion): TutorRequest {
  return {
    questaoId: randomUUID(),
    enunciado: question.statement,
    alternativas: question.options.map((o) => ({ letra: o.letter, texto: o.text })),
    respostaCorreta: question.correctOption,
    respostaAluno: question.chosen,
    disciplina: question.area,
    ...(question.source ? { fonte: question.source } : {}),
  };
}

async function runEvaluation(only: string[]): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL;
  if (!apiKey || !modelName) throw new Error("Defina GEMINI_API_KEY e GEMINI_MODEL no .env.");

  const questions = (JSON.parse(readFileSync(resolve(here, "fixtures/evalQuestions.json"), "utf8")) as EvalQuestion[]).filter(
    (q) => only.length === 0 || only.includes(q.id)
  );

  const ai = new GoogleGenAI({ apiKey });
  let lastUsage: Record<string, number | undefined> = {};
  // Envolve o cliente real só para capturar os tokens de cada chamada.
  const client = {
    async generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
      const response = await ai.models.generateContent(params);
      lastUsage = { ...(response.usageMetadata ?? {}) } as Record<string, number | undefined>;
      return response;
    },
  };
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 60_000;

  const results: CaseResult[] = [];
  for (const question of questions) {
    // Serviço novo por questão: repositório vazio, sem cache entre elas.
    const service = new TutorService(new GeminiTutorModel({ client, model: modelName, timeoutMs }), new InMemoryFeedbackRepository());
    lastUsage = {};
    const started = Date.now();
    try {
      const { feedback } = await service.explain(toRequest(question));
      const ms = Date.now() - started;
      results.push({
        id: question.id,
        area: question.area,
        correctOption: question.correctOption,
        chosen: question.chosen,
        ok: true,
        ms,
        usage: lastUsage,
        feedback,
        checks: runChecks(question, feedback),
      });
      console.log(`${question.id} [${question.area}] OK em ${(ms / 1000).toFixed(1)}s tokens=${JSON.stringify(lastUsage)}`);
    } catch (error) {
      const ms = Date.now() - started;
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      results.push({ id: question.id, area: question.area, correctOption: question.correctOption, chosen: question.chosen, ok: false, error: message, ms, usage: lastUsage });
      console.log(`${question.id} [${question.area}] FALHOU em ${(ms / 1000).toFixed(1)}s → ${message}`);
    }
  }

  const file: ResultFile = { promptVersion: PROMPT_VERSION, model: modelName, generatedAt: new Date().toISOString(), cases: results };
  mkdirSync(resultsDir, { recursive: true });
  const target = resolve(resultsDir, `resultados-${PROMPT_VERSION}.json`);
  writeFileSync(target, JSON.stringify(file, null, 2));

  const ok = results.filter((r) => r.ok);
  console.log(`\n${ok.length}/${results.length} questões geradas. Gravado em ${target}`);
  printSummary(file);
}

function summarize(file: ResultFile) {
  const ok = file.cases.filter((c) => c.ok && c.checks);
  const sum = (pick: (c: CaseResult) => number) => ok.reduce((total, c) => total + pick(c), 0);
  const comComando = ok.filter((c) => c.checks!.avisouFaltaDeComando !== null);
  return {
    geradas: `${ok.length}/${file.cases.length}`,
    distratoresCitados: `${sum((c) => c.checks!.distratoresCitados.length)}/${sum((c) => c.checks!.distratoresCitados.length + c.checks!.distratoresAusentes.length)}`,
    autorSemNome: sum((c) => c.checks!.autorSemNome),
    avisouFaltaDeComando: `${comComando.filter((c) => c.checks!.avisouFaltaDeComando).length}/${comComando.length}`,
    latenciaMediaS: ok.length ? (sum((c) => c.ms) / ok.length / 1000).toFixed(1) : "-",
    tokensSaidaMedios: ok.length ? Math.round(sum((c) => c.usage.candidatesTokenCount ?? 0) / ok.length) : 0,
    tokensPensamentoMedios: ok.length ? Math.round(sum((c) => c.usage.thoughtsTokenCount ?? 0) / ok.length) : 0,
  };
}

function printSummary(file: ResultFile): void {
  console.log(`Resumo ${file.promptVersion}:`, JSON.stringify(summarize(file), null, 2));
}

function compare(pathA: string, pathB: string): void {
  const a = JSON.parse(readFileSync(resolve(pathA), "utf8")) as ResultFile;
  const b = JSON.parse(readFileSync(resolve(pathB), "utf8")) as ResultFile;
  const sa = summarize(a);
  const sb = summarize(b);

  const lines: string[] = [`# Comparação de prompts: ${a.promptVersion} × ${b.promptVersion}`, "", `Modelo: ${a.model} / ${b.model}`, ""];
  lines.push(`| Métrica (heurística) | ${a.promptVersion} | ${b.promptVersion} |`, "|---|---|---|");
  for (const key of Object.keys(sa) as Array<keyof typeof sa>) lines.push(`| ${key} | ${sa[key]} | ${sb[key]} |`);

  for (const caseB of b.cases) {
    const caseA = a.cases.find((c) => c.id === caseB.id);
    lines.push("", `## ${caseB.id} — ${caseB.area} (correta ${caseB.correctOption}, aluno marcou ${caseB.chosen})`);
    for (const [label, c] of [[a.promptVersion, caseA], [b.promptVersion, caseB]] as const) {
      lines.push("", `### ${label}`);
      if (!c) {
        lines.push("_(sem resultado)_");
        continue;
      }
      if (!c.ok || !c.feedback) {
        lines.push(`_Falhou: ${c.error}_`);
        continue;
      }
      lines.push(
        `**${c.feedback.explicacao.titulo}** — ${c.feedback.explicacao.conteudo}`,
        "",
        `**Análise (${c.feedback.analiseAluno.alternativa}):** ${c.feedback.analiseAluno.conteudo}`,
        "",
        `**Recomendações:** ${c.feedback.recomendacoes.join("; ")}`,
        "",
        `_checagens: ${JSON.stringify(c.checks)} | ${(c.ms / 1000).toFixed(1)}s | tokens ${JSON.stringify(c.usage)}_`
      );
    }
  }
  console.log(lines.join("\n"));
}

const args = process.argv.slice(2);
if (args[0] === "--compare") {
  if (args.length !== 3) throw new Error("Uso: --compare <resultadosA.json> <resultadosB.json>");
  compare(args[1]!, args[2]!);
} else {
  await runEvaluation(args);
}
