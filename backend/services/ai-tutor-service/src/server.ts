import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { GeminiTutorModel } from "./adapters/geminiTutorModel.js";
import { PrismaFeedbackRepository } from "./adapters/prismaFeedbackRepository.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { TutorService } from "./services/tutorService.js";

// Composition root: único lugar que conhece as implementações concretas e as liga umas às outras.
const config = loadConfig();

const gemini = new GoogleGenAI({ apiKey: config.geminiApiKey });
const tutorModel = new GeminiTutorModel({
  client: gemini.models,
  model: config.geminiModel,
  timeoutMs: config.geminiTimeoutMs,
});
const tutorService = new TutorService(tutorModel, new PrismaFeedbackRepository(prisma));

const app = createApp({ tutorService, internalApiKey: config.internalApiKey });

app.listen(config.port, () => {
  console.log(`🤖 AI Tutor Service rodando na porta ${config.port} (modelo: ${config.geminiModel})`);
});
