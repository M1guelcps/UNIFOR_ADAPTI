import express from "express";
import type { NextFunction, Request, Response } from "express";
import { TutorController } from "./controllers/tutorController.js";
import { createInternalAuth } from "./middlewares/internalAuth.js";
import { createTutorRoutes } from "./routes/tutorRoutes.js";
import type { TutorService } from "./services/tutorService.js";

export interface AppDependencies {
  tutorService: TutorService;
  internalApiKey: string;
}

// Uma questão de 20k caracteres + alternativas cabe com folga; acima disso é abuso.
const BODY_LIMIT = "100kb";

/**
 * Monta o app Express sem abrir porta, para os testes subirem em porta efêmera.
 * Sem CORS de propósito: este serviço é INTERNO (chamado só pelo answer-service) e não passa pelo gateway.
 */
export function createApp({ tutorService, internalApiKey }: AppDependencies) {
  const app = express();

  app.use(express.json({ limit: BODY_LIMIT }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ service: "ai-tutor-service", status: "online" });
  });

  const controller = new TutorController(tutorService);
  app.use("/ai-tutor", createTutorRoutes(controller, createInternalAuth(internalApiKey)));

  app.use(handleBodyParserError);

  return app;
}

// JSON malformado ou grande demais vira resposta JSON clara (e não a página HTML padrão do Express).
function handleBodyParserError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  const type = (err as { type?: string } | null)?.type;

  if (type === "entity.parse.failed") {
    return res.status(400).json({ error: "Corpo da requisição não é um JSON válido." });
  }
  if (type === "entity.too.large") {
    return res.status(413).json({ error: "Corpo da requisição grande demais." });
  }

  return next(err);
}
