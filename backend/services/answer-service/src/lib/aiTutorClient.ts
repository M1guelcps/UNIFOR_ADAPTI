import type { TutorFeedback, TutorFeedbackResult, TutorRequestPayload } from "./aiTutorContract.js";
import { TutorRateLimitedError, TutorUnavailableError } from "./tutorErrors.js";

const DEFAULT_AI_TUTOR_URL = "http://localhost:3005";

// Maior que o timeout do Gemini (25s) somado a uma nova tentativa por saída inválida, para o
// answer-service nunca desistir antes do tutor. Mesmo assim é um teto: o aluno não espera para sempre.
const REQUEST_TIMEOUT_MS = 60_000;

const INTERNAL_KEY_HEADER = "x-internal-api-key";

/**
 * Pede a explicação ao AI Tutor Service (chamada interna, nunca exposta pelo gateway).
 * Falhas viram TutorRateLimitedError / TutorUnavailableError: quem chama decide a mensagem ao aluno.
 */
export async function requestTutorFeedback(
  payload: TutorRequestPayload,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<TutorFeedbackResult> {
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!apiKey) {
    throw new TutorUnavailableError("INTERNAL_API_KEY não configurada no answer-service.");
  }

  const baseUrl = process.env.AI_TUTOR_URL || DEFAULT_AI_TUTOR_URL;
  const response = await postToTutor(`${baseUrl}/ai-tutor/explain`, apiKey, payload, timeoutMs);

  return interpretTutorResponse(response);
}

async function postToTutor(
  url: string,
  apiKey: string,
  payload: TutorRequestPayload,
  timeoutMs: number
): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", [INTERNAL_KEY_HEADER]: apiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new TutorUnavailableError("Não foi possível conectar ao AI Tutor Service.", { cause: error });
  }
}

async function interpretTutorResponse(response: Response): Promise<TutorFeedbackResult> {
  if (response.status === 429) {
    throw new TutorRateLimitedError(parseRetryAfter(response.headers.get("retry-after")));
  }

  if (!response.ok) {
    // 400/401 aqui são erro de contrato ou de chave entre serviços (falha nossa); 5xx é o tutor/Gemini.
    throw new TutorUnavailableError(`O AI Tutor Service respondeu HTTP ${response.status}.`);
  }

  return readFeedback(await response.json().catch(() => null));
}

function readFeedback(body: unknown): TutorFeedbackResult {
  const envelope = body as { data?: unknown; cached?: unknown } | null;

  if (!envelope || typeof envelope.data !== "object" || envelope.data === null) {
    throw new TutorUnavailableError("O AI Tutor Service devolveu uma resposta ilegível.");
  }

  return { feedback: envelope.data as TutorFeedback, cached: envelope.cached === true };
}

function parseRetryAfter(header: string | null): number | undefined {
  const seconds = Number(header);
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined;
}
