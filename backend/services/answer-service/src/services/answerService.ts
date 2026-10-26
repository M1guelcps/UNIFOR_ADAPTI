import { prisma } from "../lib/prisma.js";

export class AnswerService {
  static async submitAnswer(questId: string, userId: string, selectedOption: string) {
    // 1. Busca a questão para descobrir qual é o gabarito
    const quest = await prisma.quest.findUnique({ 
      where: { id: questId } 
    });

    if (!quest) {
      throw new Error("Questão não encontrada no banco de dados.");
    }

    // 2. Compara a resposta escolhida com a opção correta
    const isCorrect = quest.correctOption === selectedOption;

    // 3. Registra a tentativa do aluno
    const answer = await prisma.answer.create({
      data: {
        questId,
        userId, // Em breve pegaremos isso automaticamente do JWT
        selected: selectedOption,
        isCorrect,
      },
    });

    return {
      message: isCorrect ? "Resposta correta!" : "Resposta incorreta.",
      isCorrect,
      answerId: answer.id,
      ...(!isCorrect ? { correctOption: quest.correctOption } : {}),
    };
  }
  
  static async getStudentMetrics(userId: string) {
    // Busca todas as respostas do aluno e inclui os dados da questão respondida
    const answers = await prisma.answer.findMany({
      where: { userId },
      include: {
        quest: {
          select: { area: true, statement: true, source: true } // Trazemos apenas o necessário da questão
        }
      },
      orderBy: { createdAt: "desc" },
    });

    const total = answers.length;
    const correctAnswers = answers.filter(ans => ans.isCorrect).length;
    const wrongAnswers = total - correctAnswers;
    
    // Evita divisão por zero se o aluno for novo
    const accuracyPercentage = total > 0 
      ? ((correctAnswers / total) * 100).toFixed(1) 
      : 0;

    return {
      metrics: {
        totalAnswers: total,
        correct: correctAnswers,
        wrong: wrongAnswers,
        accuracy: `${accuracyPercentage}%`,
      },
      history: answers,
    };
  }
}

