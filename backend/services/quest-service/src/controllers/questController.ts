import { Request, Response } from "express";
import { QuestService } from "../services/questService.js";

export class QuestController {
  static async importEnem(req: Request, res: Response) {
    try {
      const year = (req.query.year as string) || "2022";
      
      const result = await QuestService.importEnemQuestions(year);
      
      return res.status(201).json({
        message: `Questões do ENEM ${result.year} importadas com sucesso!`,
        count: result.importedCount
      });
    } catch (error: any) {
      console.error("[QUEST IMPORT ERROR]:", error);
      return res.status(500).json({ error: error.message || "Erro ao importar questões." });
    }
  }

    // Adicione dentro da classe QuestController
  static async listQuests(req: Request, res: Response) {
    try {
      // Extrai page e limit da URL (ex: ?page=2&limit=5)
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await QuestService.listQuests(page, limit);
      
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[QUEST LIST ERROR]:", error);
      return res.status(500).json({ error: "Erro ao listar questões." });
    }
  }
}