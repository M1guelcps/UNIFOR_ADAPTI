import type { PrismaClient } from "@prisma/client";
import { normalizeKey } from "../domain/normalizeKey.js";
import type { MaterialCatalog } from "../ports/materialCatalog.js";
import type { Material } from "../schemas/tutorResponse.js";

// Lista oferecida ao modelo: assuntos demais inflam o prompt e dispersam a escolha.
const MAX_TOPICS = 50;

export class PrismaMaterialCatalog implements MaterialCatalog {
  constructor(private readonly prisma: PrismaClient) {}

  async listTopics(disciplina: string | undefined): Promise<string[]> {
    const subject = subjectKey(disciplina);
    if (!subject) return [];

    const rows = await this.prisma.studyMaterial.findMany({
      where: { subject, active: true },
      select: { topic: true },
      distinct: ["topic"],
      orderBy: { topic: "asc" },
      take: MAX_TOPICS,
    });
    return rows.map((row) => row.topic);
  }

  async findMaterials(disciplina: string | undefined, assuntos: string[], limit: number): Promise<Material[]> {
    const subject = subjectKey(disciplina);
    if (!subject || assuntos.length === 0 || limit < 1) return [];

    const rows = await this.prisma.studyMaterial.findMany({
      where: { subject, active: true, topic: { in: assuntos } },
      // Ordem estável: o mesmo conjunto de assuntos sempre devolve os mesmos links na mesma ordem.
      orderBy: [{ topic: "asc" }, { title: "asc" }],
      take: limit,
    });
    return rows.map((row) => ({ titulo: row.title, url: row.url, descricao: row.description }));
  }
}

function subjectKey(disciplina: string | undefined): string {
  return disciplina ? normalizeKey(disciplina) : "";
}
