import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { GeminiTutorModel } from "./adapters/geminiTutorModel.js";
import { LimitedTutorModel } from "./adapters/limitedTutorModel.js";
import { PrismaFeedbackRepository } from "./adapters/prismaFeedbackRepository.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { ConcurrencyLimiter } from "./lib/concurrencyLimiter.js";
import { prisma } from "./lib/prisma.js";
import { TutorService } from "./services/tutorService.js";

// Composition root: único lugar que conhece as implementações concretas e as liga umas às outras.
const config = loadConfig();

// Fila de espera: até 5 pedidos por vaga. Acima disso, 429 imediato é melhor que o aluno esperar além do timeout.
const QUEUE_PER_SLOT = 5;

const gemini = new GoogleGenAI({ apiKey: config.geminiApiKey });
const geminiModel = new GeminiTutorModel({
  client: gemini.models,
  model: config.geminiModel,
  timeoutMs: config.geminiTimeoutMs,
  fallbackModel: config.geminiFallbackModel,
  thinkingLevel: config.geminiThinkingLevel,
  log: console.log,
});
const tutorModel = new LimitedTutorModel(
  geminiModel,
  new ConcurrencyLimiter(config.geminiMaxConcurrency, config.geminiMaxConcurrency * QUEUE_PER_SLOT)
);
const tutorService = new TutorService(tutorModel, new PrismaFeedbackRepository(prisma));

const app = createApp({ tutorService, internalApiKey: config.internalApiKey });

app.listen(config.port, () => {
  console.log(`🤖 AI Tutor Service rodando na porta ${config.port} (modelo: ${config.geminiModel})`);
});
