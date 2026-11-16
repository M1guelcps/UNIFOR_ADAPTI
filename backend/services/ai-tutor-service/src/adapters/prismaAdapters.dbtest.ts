/**
 * Testes dos adapters Prisma contra o MySQL REAL (banco apontado por DATABASE_URL).
 * Ficam fora do `npm test` (extensão .dbtest.ts) porque exigem o banco no ar e a migration aplicada:
 *
 *   npm run test:db
 *
 * Tudo o que o teste cria usa prefixos exclusivos ("dbtest-" no hash, "dbtest.invalid" na URL, disciplina
 * aleatória) e é removido ao final, sem tocar nos dados reais do desenvolvimento.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { normalizeKey } from "../domain/normalizeKey.js";
import { prisma } from "../lib/prisma.js";
import type { FeedbackEntry } from "../ports/feedbackRepository.js";
import type { TutorResponse } from "../schemas/tutorResponse.js";
import { PrismaFeedbackRepository } from "./prismaFeedbackRepository.js";
import { PrismaMaterialCatalog } from "./prismaMaterialCatalog.js";

const RUN_ID = randomBytes(4).toString("hex");
const HASH_PREFIX = `dbtest-${RUN_ID}-`;
const URL_PREFIX = `https://dbtest.invalid/${RUN_ID}/`;
// Disciplina só desta execução: nenhuma outra linha do catálogo entra na consulta.
const DISCIPLINA = `DbTest Matemática ${RUN_ID}`;
const SUBJECT = normalizeKey(DISCIPLINA);

const feedback: TutorResponse = {
  resultado: "incorreto",
  explicacao: { titulo: "t", conteudo: "c" },
  analiseAluno: { alternativa: "C", conteudo: "c" },
  contextualizacao: { titulo: "t", conteudo: "c" },
  recomendacoes: ["r"],
  materiais: [],
};

function entry(suffix: string, overrides: Partial<FeedbackEntry> = {}): FeedbackEntry {
  return {
    contentHash: `${HASH_PREFIX}${suffix}`,
    questaoId: "550e8400-e29b-41d4-a716-446655440000",
    respostaAluno: "C",
    promptVersion: "dbtest",
    model: "dbtest-model",
    feedback,
    assuntos: [],
    ...overrides,
  };
}

async function cleanup(): Promise<void> {
  await prisma.tutorFeedback.deleteMany({ where: { contentHash: { startsWith: HASH_PREFIX } } });
  await prisma.studyMaterial.deleteMany({ where: { url: { startsWith: URL_PREFIX } } });
}

describe("PrismaFeedbackRepository (MySQL real)", () => {
  const repository = new PrismaFeedbackRepository(prisma);

  before(cleanup);
  after(cleanup);

  it("grava e lê a tutoria com os assuntos escolhidos", async () => {
    await repository.save(entry("roundtrip", { assuntos: ["Porcentagem", "Geometria"] }));

    const stored = await repository.find(`${HASH_PREFIX}roundtrip`);

    assert.deepEqual(stored?.feedback, feedback);
    assert.deepEqual(stored?.assuntos, ["Porcentagem", "Geometria"]);
  });

  it("devolve null quando o hash não existe", async () => {
    assert.equal(await repository.find(`${HASH_PREFIX}inexistente`), null);
  });

  it("segunda gravação do mesmo hash NÃO falha e não duplica (P2002 tratado)", async () => {
    await repository.save(entry("duplicado"));
    await repository.save(entry("duplicado", { model: "outro-modelo" }));

    const rows = await prisma.tutorFeedback.findMany({ where: { contentHash: `${HASH_PREFIX}duplicado` } });
    assert.equal(rows.length, 1);
    // A primeira gravação vence: a tutoria guardada não é sobrescrita pela concorrente.
    assert.equal(rows[0]?.model, "dbtest-model");
  });

  it("gravações simultâneas do mesmo hash resolvem sem erro e deixam uma única linha", async () => {
    const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => repository.save(entry("concorrente"))));

    assert.deepEqual(outcomes.map((outcome) => outcome.status), Array(8).fill("fulfilled"));
    assert.equal(await prisma.tutorFeedback.count({ where: { contentHash: `${HASH_PREFIX}concorrente` } }), 1);
  });

  it("trata linha antiga sem assuntos (coluna nula) como lista vazia", async () => {
    await prisma.tutorFeedback.create({
      data: { contentHash: `${HASH_PREFIX}antiga`, questaoId: "q", respostaAluno: "A", feedback, promptVersion: "v1", model: "m" },
    });

    const stored = await repository.find(`${HASH_PREFIX}antiga`);

    assert.deepEqual(stored?.assuntos, []);
  });

  it("trata um feedback guardado fora do contrato como inexistente (será gerado de novo)", async () => {
    await prisma.tutorFeedback.create({
      data: { contentHash: `${HASH_PREFIX}invalida`, questaoId: "q", respostaAluno: "A", feedback: { formatoAntigo: true }, promptVersion: "v0", model: "m" },
    });

    assert.equal(await repository.find(`${HASH_PREFIX}invalida`), null);
  });
});

describe("PrismaMaterialCatalog (MySQL real)", () => {
  const catalog = new PrismaMaterialCatalog(prisma);

  const material = (slug: string, topic: string, overrides: { title?: string; active?: boolean; subject?: string } = {}) => ({
    title: overrides.title ?? `Material ${slug}`,
    description: `Descrição ${slug}`,
    url: `${URL_PREFIX}${slug}`,
    subject: overrides.subject ?? SUBJECT,
    topic,
    active: overrides.active ?? true,
  });

  before(async () => {
    await cleanup();
    await prisma.studyMaterial.createMany({
      data: [
        material("b-porcentagem", "Porcentagem", { title: "Beta" }),
        material("a-porcentagem", "Porcentagem", { title: "Alfa" }),
        material("regra", "Regra de três"),
        material("inativo", "Assunto inativo", { active: false }),
        material("outra-disciplina", "Porcentagem", { subject: `${SUBJECT}-outra` }),
      ],
    });
  });
  after(cleanup);

  it("lista os assuntos distintos e ativos da disciplina, em ordem alfabética", async () => {
    assert.deepEqual(await catalog.listTopics(DISCIPLINA), ["Porcentagem", "Regra de três"]);
  });

  it("casa a disciplina independentemente de acento, caixa e espaços", async () => {
    assert.deepEqual(await catalog.listTopics(SUBJECT), ["Porcentagem", "Regra de três"]);
    assert.deepEqual(await catalog.listTopics(`  ${DISCIPLINA.toUpperCase()}  `), ["Porcentagem", "Regra de três"]);
  });

  it("devolve lista vazia para disciplina ausente ou desconhecida", async () => {
    assert.deepEqual(await catalog.listTopics(undefined), []);
    assert.deepEqual(await catalog.listTopics(`inexistente-${RUN_ID}`), []);
  });

  it("busca os materiais dos assuntos pedidos, ordenados por assunto e título, no formato público", async () => {
    const materials = await catalog.findMaterials(DISCIPLINA, ["Porcentagem", "Regra de três"], 10);

    assert.deepEqual(materials.map((m) => m.titulo), ["Alfa", "Beta", "Material regra"]);
    assert.deepEqual(materials[0], { titulo: "Alfa", url: `${URL_PREFIX}a-porcentagem`, descricao: "Descrição a-porcentagem" });
  });

  it("respeita o limite e ignora materiais inativos e de outra disciplina", async () => {
    assert.equal((await catalog.findMaterials(DISCIPLINA, ["Porcentagem", "Regra de três"], 2)).length, 2);
    assert.deepEqual(await catalog.findMaterials(DISCIPLINA, ["Assunto inativo"], 10), []);
    assert.equal((await catalog.findMaterials(DISCIPLINA, ["Porcentagem"], 10)).length, 2);
  });

  it("não consulta o banco sem assuntos, sem disciplina ou com limite zero", async () => {
    assert.deepEqual(await catalog.findMaterials(DISCIPLINA, [], 10), []);
    assert.deepEqual(await catalog.findMaterials(undefined, ["Porcentagem"], 10), []);
    assert.deepEqual(await catalog.findMaterials(DISCIPLINA, ["Porcentagem"], 0), []);
  });
});

after(() => prisma.$disconnect());
