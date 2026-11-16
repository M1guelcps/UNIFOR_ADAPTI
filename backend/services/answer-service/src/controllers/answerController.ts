import { Response } from "express";
import { AnswerService } from "../services/answerService.js";
import { AuthRequest } from "../middlewares/authMiddleware.js";
import {
  AnswerNotFoundError,
  TutorQuestionInvalidError,
  TutorRateLimitedError,
  TutorUnavailableError,
} from "../lib/tutorErrors.js";

// Usado quando o tutor não informa quanto tempo esperar.
const DEFAULT_RETRY_AFTER_SECONDS = 30;

export class AnswerController {
  static async submit(req: AuthRequest, res: Response) {
    const { questId, selectedOption } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        error: "Usuário não autenticado.",
      });
    }

    if (
      typeof questId !== "string" ||
      !questId.trim() ||
      typeof selectedOption !== "string" ||
      !selectedOption.trim()
    ) {
      return res.status(400).json({
        error: "questId e selectedOption devem ser strings não vazias.",
      });
    }

    try {
      const result = await AnswerService.submitAnswer(
        questId,
        userId,
        selectedOption.trim().toUpperCase()
      );

      return res.status(201).json(result);
    } catch (error: unknown) {
      console.error("[ANSWER SUBMIT ERROR]:", error);

      const message =
        error instanceof Error ? error.message : "Erro ao salvar resposta.";

      if (message === "Questão não encontrada no banco de dados.") {
        return res.status(404).json({ error: message });
      }

      return res.status(500).json({
        error: "Não foi possível registrar a resposta.",
      });
    }
  }
  
  // Explicação do tutor para uma resposta do próprio aluno. Falhas do tutor NÃO afetam a resposta já
  // registrada: o frontend pode mostrar a mensagem e deixar o aluno tentar de novo depois.
  static async tutor(req: AuthRequest, res: Response) {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    const { answerId } = req.params;

    if (typeof answerId !== "string" || !answerId.trim()) {
      return res.status(400).json({ error: "answerId deve ser uma string não vazia." });
    }

    try {
      const result = await AnswerService.getTutorFeedback(answerId, userId);
      return res.status(200).json(result);
    } catch (error: unknown) {
      return AnswerController.respondWithTutorError(error, res);
    }
  }

  private static respondWithTutorError(error: unknown, res: Response) {
    if (error instanceof AnswerNotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    if (error instanceof TutorQuestionInvalidError) {
      return res.status(422).json({ error: error.message });
    }

    if (error instanceof TutorRateLimitedError) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS));
      return res.status(429).json({ error: "O tutor está com muitas solicitações. Tente novamente em instantes." });
    }

    console.error("[ANSWER TUTOR ERROR]:", error instanceof Error ? `${error.name}: ${error.message}` : error);

    if (error instanceof TutorUnavailableError) {
      return res.status(503).json({ error: "A explicação não está disponível agora. Sua resposta continua registrada." });
    }

    return res.status(500).json({ error: "Não foi possível gerar a explicação." });
  }

  static async getMetrics(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado." });
      }

      const data = await AnswerService.getStudentMetrics(userId);
      
      return res.status(200).json(data);
    } catch (error: any) {
      console.error("[ANSWER METRICS ERROR]:", error);
      return res.status(500).json({ error: "Erro ao buscar métricas do aluno." });
    }
  }

  static async getTeacherStats(req: AuthRequest, res: Response) {
    try {
      const data = await AnswerService.getTeacherStats(req.userId!);
      return res.status(200).json(data);
    } catch (error: any) {
      console.error("[ANSWER TEACHER STATS ERROR]:", error);
      return res.status(500).json({ error: "Erro ao buscar desempenho das suas questões." });
    }
  }

  static async getAdminStats(req: AuthRequest, res: Response) {
    try {
      const data = await AnswerService.getAdminStats();
      return res.status(200).json(data);
    } catch (error: any) {
      console.error("[ANSWER ADMIN STATS ERROR]:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas de respostas." });
    }
  }
}