import { prisma } from "../lib/prisma.js";

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

}