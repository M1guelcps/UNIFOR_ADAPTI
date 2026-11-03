import { Request, Response } from "express";
import { QuestService, QuestInput, QuestOption } from "../services/questService.js";
import { AuthRequest } from "../middlewares/authMiddleware.js";

// Valida o corpo de criação/edição. Em edição (partial), só valida o que veio.
// Alternativas aceitam ["texto A", "texto B"] ou [{ letter: "A", text: "..." }].
function parseQuestBody(body: any, partial: boolean): { data?: Partial<QuestInput>; error?: string } {
  const data: Partial<QuestInput> = {};

  if (!partial || body.statement !== undefined) {
    if (typeof body.statement !== "string" || !body.statement.trim()) {
      return { error: "statement (enunciado) é obrigatório." };
    }
    data.statement = body.statement.trim();
  }

  if (!partial || body.options !== undefined) {
    if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 5) {
      return { error: "options deve ser uma lista de 2 a 5 alternativas." };
    }

    const options: QuestOption[] = [];
    for (let i = 0; i < body.options.length; i++) {
      const raw = body.options[i];
      const text = typeof raw === "string" ? raw : raw?.text;
      const letter = String.fromCharCode(65 + i); // A, B, C...

      if (typeof text !== "string" || !text.trim()) {
        return { error: `A alternativa ${letter} está vazia.` };
      }
      options.push({ letter, text: text.trim() });
    }
    data.options = options;
  }

  if (!partial || body.correctOption !== undefined) {
    if (typeof body.correctOption !== "string" || !body.correctOption.trim()) {
      return { error: "correctOption (gabarito) é obrigatório." };
    }
    data.correctOption = body.correctOption.trim().toUpperCase();
  }

  // O gabarito precisa existir entre as alternativas.
  if (data.correctOption && data.options) {
    if (!data.options.some((o) => o.letter === data.correctOption)) {
      return { error: "correctOption precisa ser a letra de uma das alternativas." };
    }
  }

  if (body.area !== undefined) {
    data.area = typeof body.area === "string" && body.area.trim() ? body.area.trim() : null;
  }

  if (body.source !== undefined) {
    data.source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : null;
  }

  return { data };
}

function paginationFrom(req: Request) {
  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
  return { page, limit };
}

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

  // ---------- Professor / Admin ----------

  static async listMine(req: AuthRequest, res: Response) {
    try {
      const { page, limit } = paginationFrom(req);
      const result = await QuestService.listByCreator(req.userId!, page, limit);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[QUEST LIST MINE ERROR]:", error);
      return res.status(500).json({ error: "Erro ao listar suas questões." });
    }
  }

  static async getOne(req: AuthRequest, res: Response) {
    try {
      const quest = await QuestService.getById(String(req.params.id));

      if (!quest) {
        return res.status(404).json({ error: "Questão não encontrada." });
      }

      return res.status(200).json(quest);
    } catch (error: any) {
      console.error("[QUEST GET ERROR]:", error);
      return res.status(500).json({ error: "Erro ao buscar questão." });
    }
  }

  static async create(req: AuthRequest, res: Response) {
    const { data, error } = parseQuestBody(req.body ?? {}, false);

    if (error) {
      return res.status(400).json({ error });
    }

    try {
      const quest = await QuestService.createQuest(data as QuestInput, req.userId!);
      return res.status(201).json({ message: "Questão criada com sucesso!", quest });
    } catch (err: any) {
      console.error("[QUEST CREATE ERROR]:", err);
      return res.status(500).json({ error: "Erro ao criar questão." });
    }
  }

  static async update(req: AuthRequest, res: Response) {
    const { data, error } = parseQuestBody(req.body ?? {}, true);

    if (error) {
      return res.status(400).json({ error });
    }

    try {
      const id = String(req.params.id);
      const actor = { id: req.userId!, role: req.userRole! };

      // Se mudou só as alternativas ou só o gabarito, confere contra o que já está salvo.
      if ((data!.options && !data!.correctOption) || (!data!.options && data!.correctOption)) {
        const current = await QuestService.getById(id);
        if (!current) {
          return res.status(404).json({ error: "Questão não encontrada." });
        }
        const letters = (data!.options ?? (current.options as any[]) ?? []).map((o: any) => o.letter);
        const correct = data!.correctOption ?? current.correctOption;
        if (!letters.includes(correct)) {
          return res.status(400).json({ error: "correctOption precisa ser a letra de uma das alternativas." });
        }
      }

      const quest = await QuestService.updateQuest(id, data!, actor);
      return res.status(200).json({ message: "Questão atualizada!", quest });
    } catch (err: any) {
      return QuestController.handleOwnershipError(err, res, "[QUEST UPDATE ERROR]:", "Erro ao atualizar questão.");
    }
  }

  static async remove(req: AuthRequest, res: Response) {
    try {
      const actor = { id: req.userId!, role: req.userRole! };
      const result = await QuestService.deleteQuest(String(req.params.id), actor);
      return res.status(200).json({ message: "Questão excluída.", ...result });
    } catch (err: any) {
      return QuestController.handleOwnershipError(err, res, "[QUEST DELETE ERROR]:", "Erro ao excluir questão.");
    }
  }

  static async stats(req: Request, res: Response) {
    try {
      const result = await QuestService.getStats();
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[QUEST STATS ERROR]:", error);
      return res.status(500).json({ error: "Erro ao buscar estatísticas de questões." });
    }
  }

  private static handleOwnershipError(err: any, res: Response, tag: string, fallback: string) {
    if (err.message === "Questão não encontrada.") {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === "Sem permissão para alterar esta questão.") {
      return res.status(403).json({ error: err.message });
    }
    console.error(tag, err);
    return res.status(500).json({ error: fallback });
  }
}
