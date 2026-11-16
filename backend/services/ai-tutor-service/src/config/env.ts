import { z } from "zod";

// Variável opcional: vazia (ex.: "GEMINI_FALLBACK_MODEL=" no .env.example) vale como ausente.
const emptyAsUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3005),
  DATABASE_URL: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(25_000),
  // Modelo usado na nova tentativa após erro 5xx do principal. Sem ele, a nova tentativa usa o mesmo modelo.
  GEMINI_FALLBACK_MODEL: z.preprocess(emptyAsUndefined, z.string().min(1).optional()),
  // Só para modelos que aceitam thinkingLevel (ex.: um Flash completo, onde sem isso a latência passa do timeout).
  GEMINI_THINKING_LEVEL: z.preprocess(
    (value) => (typeof emptyAsUndefined(value) === "string" ? String(value).trim().toUpperCase() : undefined),
    z.enum(["MINIMAL", "LOW", "MEDIUM", "HIGH"]).optional()
  ),
  // Teto de chamadas simultâneas ao Gemini; acima dele os pedidos esperam na fila e, cheia a fila, recebem 429.
  GEMINI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
  // 16+ caracteres: uma chave curta de serviço-a-serviço é adivinhável.
  INTERNAL_API_KEY: z.string().min(16),
});

export interface AppConfig {
  port: number;
  geminiApiKey: string;
  geminiModel: string;
  geminiTimeoutMs: number;
  geminiFallbackModel?: string;
  geminiThinkingLevel?: "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
  geminiMaxConcurrency: number;
  internalApiKey: string;
}

/**
 * Lê e valida as variáveis de ambiente na inicialização, para o serviço falhar de imediato
 * (e não na primeira requisição de um aluno) quando faltar algo.
 *
 * CUIDADO: a mensagem de erro cita apenas os NOMES das variáveis inválidas, nunca os valores,
 * porque o log do processo não pode vazar a GEMINI_API_KEY.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);

  if (!parsed.success) {
    const invalid = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Configuração inválida no .env: ${invalid.join(", ")}. Veja o .env.example.`);
  }

  const values = parsed.data;
  return {
    port: values.PORT,
    geminiApiKey: values.GEMINI_API_KEY,
    geminiModel: values.GEMINI_MODEL,
    geminiTimeoutMs: values.GEMINI_TIMEOUT_MS,
    geminiFallbackModel: values.GEMINI_FALLBACK_MODEL,
    geminiThinkingLevel: values.GEMINI_THINKING_LEVEL,
    geminiMaxConcurrency: values.GEMINI_MAX_CONCURRENCY,
    internalApiKey: values.INTERNAL_API_KEY,
  };
}
