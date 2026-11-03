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

  // Desempenho dos alunos nas questões criadas por um professor.
  static async getTeacherStats(teacherId: string) {
    const quests = await prisma.quest.findMany({
      where: { creatorId: teacherId },
      select: {
        id: true,
        statement: true,
        area: true,
        source: true,
        correctOption: true,
        createdAt: true,
        answers: { select: { userId: true, selected: true, isCorrect: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const students = new Set<string>();
    let totalAnswers = 0;
    let totalCorrect = 0;

    const perQuest = quests.map((q) => {
      const distribution: Record<string, number> = {};
      let correct = 0;

      q.answers.forEach((a) => {
        students.add(a.userId);
        distribution[a.selected] = (distribution[a.selected] || 0) + 1;
        if (a.isCorrect) correct++;
      });

      totalAnswers += q.answers.length;
      totalCorrect += correct;

      return {
        questId: q.id,
        statement: q.statement,
        area: q.area,
        source: q.source,
        correctOption: q.correctOption,
        createdAt: q.createdAt,
        totalAnswers: q.answers.length,
        correct,
        accuracy: percent(correct, q.answers.length),
        distribution,
      };
    });

    return {
      summary: {
        totalQuests: quests.length,
        totalAnswers,
        correct: totalCorrect,
        wrong: totalAnswers - totalCorrect,
        accuracy: percent(totalCorrect, totalAnswers),
        uniqueStudents: students.size,
      },
      perQuest,
    };
  }

  // Visão geral da plataforma para o administrador.
  static async getAdminStats() {
    const answers = await prisma.answer.findMany({
      select: {
        userId: true,
        isCorrect: true,
        createdAt: true,
        quest: { select: { area: true } },
      },
    });

    const students = new Set<string>();
    const areas: Record<string, { total: number; correct: number }> = {};
    let correct = 0;

    // Respostas por dia nos últimos 7 dias (inclui hoje)
    const last7Days: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push({ date: d.toISOString().slice(0, 10), total: 0 });
    }

    answers.forEach((a) => {
      students.add(a.userId);
      if (a.isCorrect) correct++;

      const area = a.quest?.area || "Sem área";
      areas[area] ??= { total: 0, correct: 0 };
      areas[area].total++;
      if (a.isCorrect) areas[area].correct++;

      const day = last7Days.find((d) => d.date === a.createdAt.toISOString().slice(0, 10));
      if (day) day.total++;
    });

    return {
      summary: {
        totalAnswers: answers.length,
        correct,
        wrong: answers.length - correct,
        accuracy: percent(correct, answers.length),
        activeStudents: students.size,
      },
      byArea: Object.entries(areas)
        .map(([area, v]) => ({ area, total: v.total, correct: v.correct, accuracy: percent(v.correct, v.total) }))
        .sort((a, b) => b.total - a.total),
      last7Days,
    };
  }
}

// Mesmo formato do /answers/me: "75.0%"
function percent(part: number, total: number) {
  return `${total > 0 ? ((part / total) * 100).toFixed(1) : 0}%`;
}

