/**
 * Cadastro do catálogo de materiais (tabela study_materials do banco adapti_tutor).
 * A fonte da verdade é prisma/seeds/studyMaterials.json: para mudar o catálogo, edite o JSON e rode de novo.
 *
 *   npm run materials:seed -- --check   → só confere o JSON e se cada URL responde (não toca no banco)
 *   npm run materials:seed              → grava no banco: cria/atualiza pela URL e DESATIVA o que saiu do JSON
 *
 * Nada é apagado: um material removido do JSON fica com active=false (some das recomendações, o histórico fica).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { normalizeKey } from "../src/domain/normalizeKey.js";

const seedFile = resolve(dirname(fileURLToPath(import.meta.url)), "../prisma/seeds/studyMaterials.json");

const MaterialSeedSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(2_000),
  url: z.url().max(500).refine((url) => url.startsWith("https://"), "Use uma URL https."),
  // Disciplina como o Answer Service a envia (ex.: "matematica"); é normalizada na gravação.
  subject: z.string().trim().min(1).max(100),
  // Assunto exatamente como será oferecido ao modelo na lista do catálogo.
  topic: z.string().trim().min(1).max(150),
  active: z.boolean().default(true),
});

type MaterialSeed = z.infer<typeof MaterialSeedSchema>;

function loadSeed(): MaterialSeed[] {
  const parsed = z.array(MaterialSeedSchema).min(1).safeParse(JSON.parse(readFileSync(seedFile, "utf8")));
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  [${issue.path.join(".")}] ${issue.message}`).join("\n");
    throw new Error(`studyMaterials.json inválido:\n${problems}`);
  }

  const seen = new Set<string>();
  for (const material of parsed.data) {
    if (seen.has(material.url)) throw new Error(`URL repetida no seed: ${material.url}`);
    seen.add(material.url);
  }
  return parsed.data;
}

/** Confere que cada URL responde 2xx. Mostra o <title> e o destino final para o humano revisar se a página é a certa. */
async function checkUrls(materials: MaterialSeed[]): Promise<boolean> {
  let allOk = true;

  for (const material of materials) {
    try {
      const response = await fetch(material.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AdaptiCatalogCheck/1.0)", Accept: "text/html,*/*" },
      });
      const html = response.ok ? (await response.text()).slice(0, 200_000) : "";
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, " ").trim() ?? "(sem <title>)";
      const moved = response.url !== material.url ? `  → ${response.url}` : "";

      if (response.ok) {
        console.log(`OK    ${response.status} [${material.subject}/${material.topic}] ${title}${moved}`);
      } else {
        allOk = false;
        console.log(`FALHA ${response.status} [${material.subject}/${material.topic}] ${material.url}`);
      }
    } catch (error) {
      allOk = false;
      console.log(`FALHA rede [${material.subject}/${material.topic}] ${material.url} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return allOk;
}

async function writeToDatabase(materials: MaterialSeed[]): Promise<void> {
  const { prisma } = await import("../src/lib/prisma.js");

  try {
    const existing = new Set((await prisma.studyMaterial.findMany({ select: { url: true } })).map((row) => row.url));
    let created = 0;
    let updated = 0;

    for (const material of materials) {
      const data = {
        title: material.title,
        description: material.description,
        subject: normalizeKey(material.subject),
        topic: material.topic,
        active: material.active,
      };
      await prisma.studyMaterial.upsert({ where: { url: material.url }, create: { url: material.url, ...data }, update: data });
      if (existing.has(material.url)) updated += 1;
      else created += 1;
    }

    const removed = await prisma.studyMaterial.updateMany({
      where: { url: { notIn: materials.map((material) => material.url) }, active: true },
      data: { active: false },
    });

    console.log(`Catálogo gravado: ${created} criado(s), ${updated} atualizado(s), ${removed.count} desativado(s) por terem saído do JSON.`);
  } finally {
    await prisma.$disconnect();
  }
}

const materials = loadSeed();
console.log(`${materials.length} materiais válidos em ${seedFile}`);

if (process.argv.includes("--check")) {
  const allOk = await checkUrls(materials);
  if (!allOk) {
    console.error("\nHá URLs com falha: corrija o JSON antes de gravar.");
    process.exitCode = 1;
  }
} else {
  await writeToDatabase(materials);
}
