import { ApiError, ThinkingLevel } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  TutorInvalidOutputError,
  TutorRateLimitedError,
  TutorUnavailableError,
} from "../domain/tutorErrors.js";
import type { ModelCompletion, ModelUsage, TutorModel } from "../ports/tutorModel.js";
import { TUTOR_SYSTEM_PROMPT } from "../prompts/tutorPrompt.js";
import { buildModelResponseJsonSchema } from "../schemas/tutorResponse.js";

/** Parte do SDK que usamos; `GoogleGenAI().models` satisfaz esta interface e os testes passam um stub. */
export interface GeminiContentGenerator {
  generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
}

export type ThinkingLevelName = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

export interface GeminiTutorModelOptions {
  client: GeminiContentGenerator;
  model: string;
  timeoutMs: number;
  /** Modelo usado na nova tentativa após erro 5xx. Sem ele, a nova tentativa usa o mesmo modelo. */
  fallbackModel?: string;
  /** Nível de raciocínio. Só é enviado quando configurado (nem todo modelo aceita). */
  thinkingLevel?: ThinkingLevelName;
  /** Recebe uma linha de métricas por chamada ao provedor. Padrão: silencioso. */
  log?: (line: string) => void;
  /** Espera antes da nova tentativa. Injetável para os testes não esperarem de verdade. */
  sleep?: (ms: number) => Promise<void>;
}

// Folga para modelos que gastam tokens "pensando" antes do JSON; um limite baixo truncaria a resposta.
const MAX_OUTPUT_TOKENS = 4096;
const TEMPERATURE = 0.3;

// 503 do Gemini costuma ser pontual (apareceu em 2 de 9 chamadas reais): uma nova tentativa curta resolve.
const RETRY_DELAY_MIN_MS = 1_000;
const RETRY_DELAY_JITTER_MS = 1_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Adapter do Gemini: é a única classe que conhece o SDK. Traduz os erros do provedor para os
 * erros de domínio (rate limit / indisponível / saída inválida) e nunca devolve texto fora de JSON.
 *
 * Nova tentativa: só para HTTP 5xx, uma vez, após 1–2 s. Timeout e falha de rede NÃO são repetidos
 * (dobrariam a espera do aluno) e 429/4xx também não (repetir não resolve).
 */
export class GeminiTutorModel implements TutorModel {
  readonly name: string;
  private readonly responseJsonSchema = buildModelResponseJsonSchema();
  private readonly log: (line: string) => void;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: GeminiTutorModelOptions) {
    this.name = options.model;
    this.log = options.log ?? (() => {});
    this.sleep = options.sleep ?? defaultSleep;
  }

  async generateFeedback(content: string): Promise<ModelCompletion> {
    const { model, fallbackModel } = this.options;
    let usedModel = model;
    let response: GenerateContentResponse;

    try {
      response = await this.callProvider(model, content, 1);
    } catch (error) {
      if (!isServerError(error)) throw translateProviderError(error);

      await this.sleep(RETRY_DELAY_MIN_MS + Math.random() * RETRY_DELAY_JITTER_MS);

      usedModel = fallbackModel ?? model;
      try {
        response = await this.callProvider(usedModel, content, 2);
      } catch (retryError) {
        throw translateProviderError(retryError);
      }
    }

    return { data: parseJsonText(response.text), model: usedModel, usage: extractUsage(response) };
  }

  /** Uma chamada ao provedor, com a linha de métricas (nunca o conteúdo da questão nem da resposta). */
  private async callProvider(model: string, content: string, attempt: number): Promise<GenerateContentResponse> {
    const started = Date.now();
    try {
      const response = await this.options.client.generateContent({
        model,
        contents: content,
        config: {
          systemInstruction: TUTOR_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: this.responseJsonSchema,
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          httpOptions: { timeout: this.options.timeoutMs },
          ...(this.options.thinkingLevel ? { thinkingConfig: { thinkingLevel: ThinkingLevel[this.options.thinkingLevel] } } : {}),
        },
      });
      this.logCall(model, attempt, started, "ok", extractUsage(response));
      return response;
    } catch (error) {
      this.logCall(model, attempt, started, describeOutcome(error), {});
      throw error;
    }
  }

  private logCall(model: string, attempt: number, started: number, outcome: string, usage: ModelUsage): void {
    const fields: Array<[string, string | number | undefined]> = [
      ["model", model],
      ["attempt", attempt],
      ["latencyMs", Date.now() - started],
      ["outcome", outcome],
      ["promptTokens", usage.promptTokens],
      ["outputTokens", usage.outputTokens],
      ["thoughtsTokens", usage.thoughtsTokens],
      ["totalTokens", usage.totalTokens],
    ];
    this.log(`[TUTOR GEMINI] ${fields.filter(([, value]) => value !== undefined).map(([key, value]) => `${key}=${value}`).join(" ")}`);
  }
}

function isServerError(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 500;
}

function describeOutcome(error: unknown): string {
  return error instanceof ApiError ? `http_${error.status}` : "network_error";
}

function extractUsage(response: GenerateContentResponse): ModelUsage {
  const metadata = response.usageMetadata;
  return {
    promptTokens: metadata?.promptTokenCount,
    outputTokens: metadata?.candidatesTokenCount,
    thoughtsTokens: metadata?.thoughtsTokenCount,
    totalTokens: metadata?.totalTokenCount,
  };
}

function parseJsonText(text: string | undefined): unknown {
  if (!text || !text.trim()) {
    throw new TutorInvalidOutputError("O Gemini não retornou conteúdo.");
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new TutorInvalidOutputError("O Gemini retornou um JSON malformado.", { cause: error });
  }
}

/**
 * CUIDADO: a mensagem do erro traduzido não repete a do provedor (pode conter detalhes da requisição);
 * o original fica em `cause` apenas para diagnóstico.
 */
function translateProviderError(error: unknown): Error {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new TutorRateLimitedError(undefined, { cause: error });
    }
    if (error.status >= 500 || error.status === 408) {
      return new TutorUnavailableError("O Gemini está indisponível no momento.", { cause: error });
    }
    // 400/401/403/404: chave, modelo ou schema mal configurados — falha nossa, não do aluno.
    return new TutorUnavailableError(`O Gemini recusou a requisição (HTTP ${error.status}). Verifique GEMINI_API_KEY e GEMINI_MODEL.`, { cause: error });
  }

  // Timeout, DNS, conexão recusada etc.
  return new TutorUnavailableError("Falha de comunicação com o Gemini.", { cause: error });
}
