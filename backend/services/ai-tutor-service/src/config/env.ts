import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3005),
  DATABASE_URL: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(25_000),
  // 16+ caracteres: uma chave curta de serviço-a-serviço é adivinhável.
  INTERNAL_API_KEY: z.string().min(16),
});

export interface AppConfig {
  port: number;
  geminiApiKey: string;
  geminiModel: string;
  geminiTimeoutMs: number;
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
    internalApiKey: values.INTERNAL_API_KEY,
  };
}
