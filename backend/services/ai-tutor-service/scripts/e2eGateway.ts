/**
 * Teste de ponta a ponta pelo Gateway, como o frontend faria: cadastra usuários de teste, importa o
 * ENEM, responde questões variadas e pede a explicação ao tutor. Também confere cache, isolamento
 * entre alunos, autenticação e gabarito inválido.
 *
 *   (todos os serviços no ar: gateway 3000, auth, quest, answer, tutor 3005, MySQL)
 *   npm run e2e:gateway -- scripts/results/e2e-gateway.json
 *
 * ATENÇÃO: cria usuários e respostas REAIS no banco de desenvolvimento e consome cota do Gemini.
 * Variáveis opcionais: GATEWAY_URL (padrão http://localhost:3000) e AI_TUTOR_URL (padrão http://localhost:3005).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const GATEWAY = process.env.GATEWAY_URL ?? "http://localhost:3000";
const TUTOR_DIRECT = process.env.AI_TUTOR_URL ?? "http://localhost:3005";
const OUT = resolve(process.argv[2] ?? "scripts/results/e2e-gateway.json");

interface Quest {
  id: string;
  area: string;
  source: string | null;
  statement: string;
  options: Array<{ letter?: string; text?: string; file?: unknown } | null>;
  correctOption: string;
}

interface CallResult {
  status: number;
  json: Record<string, any> | null;
  text?: string;
  ms: number;
  retryAfter: string | null;
}

const results: Record<string, any> = { setup: {}, cases: [], cache: null, security: [], invalid: null };

async function call(method: string, path: string, { token, body }: { token?: string; body?: unknown } = {}): Promise<CallResult> {
  const started = Date.now();
  const response = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: Record<string, any> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* corpo não-JSON */
  }
  return { status: response.status, json, text: json ? undefined : text.slice(0, 200), ms: Date.now() - started, retryAfter: response.headers.get("retry-after") };
}

async function userToken(name: string, email: string, role: string): Promise<string | undefined> {
  const password = "SenhaTeste#2026";
  const registered = await call("POST", "/auth/register", { body: { name, email, password, role } });
  const login = await call("POST", "/auth/login", { body: { email, password } });
  results.setup[email] = { register: registered.status, login: login.status, role: login.json?.user?.role, erro: registered.json?.error ?? login.json?.error };
  return login.json?.token;
}

const hasStatementImage = (q: Quest) => /!\[[^\]]*\]\([^)]+\)/.test(q.statement);
const hasImageOnlyOption = (q: Quest) => q.options.some((o) => o && o.file && !(o.text ?? "").trim());
const validGabarito = (q: Quest) => /^[A-E]$/.test(q.correctOption);

// 1. Usuários de teste
const admin = await userToken("Tutor Teste Admin", "tutor.admin@teste.local", "ADMIN");
const alunoA = await userToken("Tutor Teste Aluno A", "tutor.alunoa@teste.local", "STUDENT");
const alunoB = await userToken("Tutor Teste Aluno B", "tutor.alunob@teste.local", "STUDENT");

// 2. Importa ENEM (admin)
const imported = await call("POST", "/quests/import/enem?year=2022", { token: admin });
results.setup.importEnem = { status: imported.status, body: imported.json ?? imported.text, ms: imported.ms };

// 3. Lista e seleciona questões variadas
const list = await call("GET", "/quests?page=1&limit=100", { token: alunoA });
const quests: Quest[] = list.json?.data ?? [];
results.setup.questoes = {
  total: quests.length,
  enunciadoComImagem: quests.filter(hasStatementImage).length,
  alternativaSoImagem: quests.filter(hasImageOnlyOption).length,
  gabaritoInvalido: quests.filter((q) => !validGabarito(q)).length,
  areas: [...new Set(quests.map((q) => q.area))],
};

const usable = quests.filter(validGabarito);
const picked: Array<{ q: Quest; tag: string }> = [];
const add = (q: Quest | undefined, tag: string) => {
  if (q && !picked.some((p) => p.q.id === q.id)) picked.push({ q, tag });
};
add(usable.find(hasStatementImage), "enunciado-com-imagem");
add(usable.find(hasImageOnlyOption), "alternativa-so-imagem");
for (const area of results.setup.questoes.areas as string[]) {
  if (picked.length >= 6) break;
  add(usable.find((q) => q.area === area && !hasStatementImage(q) && !hasImageOnlyOption(q)), `texto:${area}`);
}
for (const q of usable) {
  if (picked.length >= 6) break;
  add(q, "complemento");
}

// 4. Responde (errado, exceto o último: certo) e pede a explicação
for (const [i, { q, tag }] of picked.entries()) {
  const letters = q.options.map((o, k) => String(o?.letter ?? "ABCDE"[k]).toUpperCase());
  const correct = q.correctOption;
  const chosen = i === picked.length - 1 ? correct : letters.find((l) => l !== correct);
  const answer = await call("POST", "/answers", { token: alunoA, body: { questId: q.id, selectedOption: chosen } });
  const tutor = await call("POST", `/answers/${answer.json?.answerId}/tutor`, { token: alunoA });
  results.cases.push({
    tag, questId: q.id, area: q.area, source: q.source, statement: q.statement, options: q.options, correctOption: correct, chosen,
    submit: { status: answer.status, isCorrect: answer.json?.isCorrect, ms: answer.ms },
    tutor: { status: tutor.status, ms: tutor.ms, cached: tutor.json?.cached, isCorrect: tutor.json?.isCorrect, body: tutor.json?.tutor ?? tutor.json ?? tutor.text, retryAfter: tutor.retryAfter },
  });
  console.log(`${i + 1}. [${tag}] submit=${answer.status} tutor=${tutor.status} em ${tutor.ms}ms cached=${tutor.json?.cached}`);
}

// 5. Cache: aluno B responde a 1ª questão igual ao aluno A → deve vir do cache, rápido
const first = results.cases.find((c: any) => c.tutor.status === 200);
if (first) {
  const answerB = await call("POST", "/answers", { token: alunoB, body: { questId: first.questId, selectedOption: first.chosen } });
  const tutorB = await call("POST", `/answers/${answerB.json?.answerId}/tutor`, { token: alunoB });
  results.cache = { status: tutorB.status, cached: tutorB.json?.cached, ms: tutorB.ms, mesmoConteudo: JSON.stringify(tutorB.json?.tutor) === JSON.stringify(first.tutor.body) };

  // 6. Segurança
  const answerIdA = (await call("POST", "/answers", { token: alunoA, body: { questId: first.questId, selectedOption: first.chosen } })).json?.answerId;
  const record = (nome: string, r: CallResult) => results.security.push({ nome, status: r.status, erro: r.json?.error });
  record("aluno B pede explicação da resposta do aluno A", await call("POST", `/answers/${answerIdA}/tutor`, { token: alunoB }));
  record("sem token", await call("POST", `/answers/${answerIdA}/tutor`));
  record("answerId inexistente", await call("POST", "/answers/00000000-0000-4000-8000-000000000000/tutor", { token: alunoA }));
  const direct = await fetch(`${TUTOR_DIRECT}/ai-tutor/explain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  results.security.push({ nome: "chamada direta ao tutor sem chave interna", status: direct.status });
  record("tutor via gateway (não deve existir rota)", await call("POST", "/ai-tutor/explain", { body: {} }));
}

// 7. Questão com gabarito inválido → 422
const bad = quests.find((q) => !validGabarito(q));
if (bad) {
  const answer = await call("POST", "/answers", { token: alunoA, body: { questId: bad.id, selectedOption: "A" } });
  const tutor = await call("POST", `/answers/${answer.json?.answerId}/tutor`, { token: alunoA });
  results.invalid = { correctOption: bad.correctOption, status: tutor.status, erro: tutor.json?.error };
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`Resultado gravado em ${OUT}`);
console.log("setup:", JSON.stringify(results.setup, null, 1));
console.log("cache:", JSON.stringify(results.cache));
console.log("segurança:", JSON.stringify(results.security, null, 1));
console.log("gabarito inválido:", JSON.stringify(results.invalid));
