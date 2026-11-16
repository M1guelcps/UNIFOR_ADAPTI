/**
 * Compara modelos candidatos do Gemini com o adapter e a validação REAIS do tutor (sem banco).
 *
 *   npm run compare:models -- gemini-x gemini-y:low
 *   QUESTAO=dificil npm run compare:models -- gemini-x
 *
 * Cada candidato é "<modelo>" ou "<modelo>:<thinkingLevel>" (ex.: gemini-3-flash:low).
 * Sem thinkingLevel, o SDK usa o padrão do modelo.
 */
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { GeminiTutorModel } from "../src/adapters/geminiTutorModel.js";
import { TutorService } from "../src/services/tutorService.js";
import { InMemoryFeedbackRepository, validRequest } from "../src/testing/fakes.js";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Defina GEMINI_API_KEY no .env.");

const candidates = process.argv.slice(2);
if (candidates.length === 0) throw new Error("Informe ao menos um modelo. Ex.: npm run compare:models -- gemini-x gemini-y:low");

const ai = new GoogleGenAI({ apiKey });

// Questão de raciocínio: o aluno somou as porcentagens (erro clássico) em vez de compô-las.
const hard = validRequest({
  enunciado:
    "Uma loja aumentou o preço de um produto em 20% e, no mês seguinte, concedeu um desconto de 20% sobre o novo preço. Em relação ao preço original, o preço final é:",
  alternativas: [
    { letra: "A", texto: "igual ao preço original" },
    { letra: "B", texto: "4% menor que o preço original" },
    { letra: "C", texto: "4% maior que o preço original" },
    { letra: "D", texto: "20% menor que o preço original" },
    { letra: "E", texto: "40% menor que o preço original" },
  ],
  respostaCorreta: "B",
  respostaAluno: "A",
  disciplina: "Matemática",
  fonte: "Questão de teste",
});

for (const candidate of candidates) {
  const [name, thinkingLevel] = candidate.split(":") as [string, string | undefined];
  let usage: Record<string, number | undefined> = {};

  // Envolve o cliente real para capturar tokens e, opcionalmente, injetar o nível de raciocínio.
  const client = {
    async generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> {
      const config = thinkingLevel
        ? { ...params.config, thinkingConfig: { thinkingLevel: thinkingLevel.toUpperCase() } }
        : params.config;
      const response = await ai.models.generateContent({ ...params, config } as GenerateContentParameters);
      usage = { ...(response.usageMetadata ?? {}) } as Record<string, number | undefined>;
      return response;
    },
  };
  const service = new TutorService(new GeminiTutorModel({ client, model: name, timeoutMs: 60_000 }), new InMemoryFeedbackRepository());

  const started = Date.now();
  try {
    const { feedback } = await service.explain(process.env.QUESTAO === "dificil" ? hard : validRequest());
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n=== ${candidate}: OK em ${seconds}s | tokens entrada=${usage.promptTokenCount} saída=${usage.candidatesTokenCount} pensamento=${usage.thoughtsTokenCount ?? 0}`);
    console.log(`explicacao: ${feedback.explicacao.titulo} — ${feedback.explicacao.conteudo}`);
    console.log(`analiseAluno(${feedback.analiseAluno.alternativa}): ${feedback.analiseAluno.conteudo}`);
    console.log(`recomendacoes: ${JSON.stringify(feedback.recomendacoes)}`);
  } catch (error) {
    const cause = (error as { cause?: { status?: number; message?: string } }).cause;
    console.log(`\n=== ${candidate}: FALHOU em ${((Date.now() - started) / 1000).toFixed(1)}s → ${(error as Error).name}: ${(error as Error).message}`);
    if (cause?.message) console.log(`causa (HTTP ${cause.status ?? "?"}): ${String(cause.message).slice(0, 400)}`);
  }
}
