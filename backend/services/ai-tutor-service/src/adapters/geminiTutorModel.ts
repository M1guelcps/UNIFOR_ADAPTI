import { ApiError } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import {
  TutorInvalidOutputError,
  TutorRateLimitedError,
  TutorUnavailableError,
} from "../domain/tutorErrors.js";
import type { TutorModel } from "../ports/tutorModel.js";
import { TUTOR_SYSTEM_PROMPT } from "../prompts/tutorPrompt.js";
import { buildModelResponseJsonSchema } from "../schemas/tutorResponse.js";

/** Parte do SDK que usamos; `GoogleGenAI().models` satisfaz esta interface e os testes passam um stub. */
export interface GeminiContentGenerator {
  generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
}

export interface GeminiTutorModelOptions {
  client: GeminiContentGenerator;
  model: string;
  timeoutMs: number;
}

// Folga para modelos que gastam tokens "pensando" antes do JSON; um limite baixo truncaria a resposta.
const MAX_OUTPUT_TOKENS = 4096;
const TEMPERATURE = 0.3;

/**
 * Adapter do Gemini: é a única classe que conhece o SDK. Traduz os erros do provedor para os
 * erros de domínio (rate limit / indisponível / saída inválida) e nunca devolve texto fora de JSON.
 */
export class GeminiTutorModel implements TutorModel {
  readonly name: string;
  private readonly responseJsonSchema = buildModelResponseJsonSchema();

  constructor(private readonly options: GeminiTutorModelOptions) {
    this.name = options.model;
  }

  async generateFeedback(content: string): Promise<unknown> {
    const response = await this.requestCompletion(content);
    return parseJsonText(response.text);
  }

  private async requestCompletion(content: string): Promise<GenerateContentResponse> {
    try {
      return await this.options.client.generateContent({
        model: this.options.model,
        contents: content,
        config: {
          systemInstruction: TUTOR_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: this.responseJsonSchema,
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          httpOptions: { timeout: this.options.timeoutMs },
        },
      });
    } catch (error) {
      throw translateProviderError(error);
    }
  }
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
