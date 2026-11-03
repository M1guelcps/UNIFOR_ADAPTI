import { Response } from "express";
import { AnswerService } from "../services/answerService.js";
import { AuthRequest } from "../middlewares/authMiddleware.js";

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