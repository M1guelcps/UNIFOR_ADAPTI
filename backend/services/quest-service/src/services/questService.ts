import { prisma } from "../lib/prisma.js";

export interface QuestOption {
  letter: string;
  text: string;
}

export interface QuestInput {
  statement: string;
  options: QuestOption[];
  correctOption: string;
  area?: string | null;
  source?: string | null;
}

interface Actor {
  id: string;
  role: string;
}

export class QuestService {
  static async importEnemQuestions(year: string = "2022") {
    // Usando a API oficial escolhida com um limite de 50 questões
    const API_URL = `https://api.enem.dev/v1/exams/${year}/questions?limit=50`;

    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Falha ao buscar questões da API enem.dev (Status: ${response.status})`);
    }

    const data = await response.json();

    // A API enem.dev geralmente retorna os dados dentro de um array
    const questionsArray = Array.isArray(data) ? data : data.questions;

    if (!questionsArray || questionsArray.length === 0) {
      throw new Error(`Nenhuma questão encontrada para o ano ${year}.`);
    }

    // 1. Mapear o payload da API para o nosso Prisma Schema
    const questsToInsert = questionsArray.map((item: any) => {
      return {
        // Mapeamento dinâmico baseado no padrão da enem.dev
        statement: item.context || item.statement || item.title || "Enunciado não disponível",
        options: item.alternatives || item.options || [],
        correctOption: item.correctAlternative || item.answer || "Não definida",
        source: `ENEM ${year}`,
        area: item.discipline || item.area || "Geral",
      };
    });

    // 2. Inserir em massa no MySQL (adapti_quest)
    const result = await prisma.quest.createMany({
      data: questsToInsert,
      skipDuplicates: true,
    });

    return { importedCount: result.count, year };
  }


  static async listQuests(page: number = 1, limit: number = 10) {
    // Calcula quantos registros pular com base na página atual
    const skip = (page - 1) * limit;

    // Executa a busca e a contagem ao mesmo tempo
    const [quests, total] = await prisma.$transaction([
      prisma.quest.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" }, // Traz as mais recentes primeiro
      }),
      prisma.quest.count(),
    ]);

    return {
      data: quests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------- Professor / Admin ----------

  static async listByCreator(creatorId: string, page: number = 1, limit: number = 10) {
    const where = { creatorId };

    const [quests, total] = await prisma.$transaction([
      prisma.quest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { answers: true } } },
      }),
      prisma.quest.count({ where }),
    ]);

    return {
      data: quests,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string) {
    return prisma.quest.findUnique({
      where: { id },
      include: { _count: { select: { answers: true } } },
    });
  }

  static async createQuest(data: QuestInput, creatorId: string) {
    return prisma.quest.create({
      data: {
        statement: data.statement,
        options: data.options as any,
        correctOption: data.correctOption,
        area: data.area ?? null,
        source: data.source ?? "Autoral",
        creatorId,
      },
    });
  }

  // Professor só altera as próprias questões; admin altera qualquer uma.
  private static async ensureCanEdit(id: string, actor: Actor) {
    const quest = await prisma.quest.findUnique({ where: { id } });

    if (!quest) {
      throw new Error("Questão não encontrada.");
    }

    if (actor.role !== "ADMIN" && quest.creatorId !== actor.id) {
      throw new Error("Sem permissão para alterar esta questão.");
    }

    return quest;
  }

  static async updateQuest(id: string, data: Partial<QuestInput>, actor: Actor) {
    await QuestService.ensureCanEdit(id, actor);

    return prisma.quest.update({
      where: { id },
      data: {
        ...(data.statement !== undefined ? { statement: data.statement } : {}),
        ...(data.options !== undefined ? { options: data.options as any } : {}),
        ...(data.correctOption !== undefined ? { correctOption: data.correctOption } : {}),
        ...(data.area !== undefined ? { area: data.area } : {}),
        ...(data.source !== undefined ? { source: data.source } : {}),
      },
    });
  }

  static async deleteQuest(id: string, actor: Actor) {
    await QuestService.ensureCanEdit(id, actor);

    // As respostas dependem da questão (chave estrangeira), então saem primeiro.
    const [deletedAnswers] = await prisma.$transaction([
      prisma.answer.deleteMany({ where: { questId: id } }),
      prisma.quest.delete({ where: { id } }),
    ]);

    return { deletedAnswers: deletedAnswers.count };
  }

  static async getStats() {
    const [total, authored, byArea, bySource] = await prisma.$transaction([
      prisma.quest.count(),
      prisma.quest.count({ where: { creatorId: { not: null } } }),
      prisma.quest.groupBy({ by: ["area"], _count: { _all: true }, orderBy: { area: "asc" } }),
      prisma.quest.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { source: "asc" } }),
    ]);

    return {
      total,
      authored,
      imported: total - authored,
      byArea: byArea.map((g: any) => ({ area: g.area ?? "Sem área", count: g._count._all })),
      bySource: bySource.map((g: any) => ({ source: g.source ?? "Sem fonte", count: g._count._all })),
    };
  }
}
