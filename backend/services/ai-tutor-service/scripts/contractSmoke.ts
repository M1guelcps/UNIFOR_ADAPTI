/**
 * Teste de contrato entre os serviços: o app REAL do ai-tutor-service (com modelo falso) recebendo
 * chamadas do cliente e do mapper REAIS do answer-service. Se alguém mudar o contrato de um lado
 * sem mudar do outro, este script quebra.
 *
 *   npm run smoke:contract
 *
 * O answer-service é só LIDO (import); nada nele é alterado. Os imports são dinâmicos e por URL
 * de propósito: o tsc do tutor não deve tipar código de outro serviço.
 */
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createApp } from "../src/app.js";
import { TutorService } from "../src/services/tutorService.js";
import { FakeTutorModel, InMemoryFeedbackRepository, validModelOutput } from "../src/testing/fakes.js";

const answerSrc = pathToFileURL(resolve(fileURLToPath(import.meta.url), "../../../answer-service/src")).href;

const { requestTutorFeedback } = (await import(`${answerSrc}/lib/aiTutorClient.ts`)) as {
  requestTutorFeedback: (payload: unknown) => Promise<{ feedback: { resultado: string; analiseAluno: { alternativa: string }; materiais: unknown[] }; cached: boolean }>;
};
const { toTutorRequest } = (await import(`${answerSrc}/services/tutorRequestMapper.ts`)) as {
  toTutorRequest: (quest: unknown, chosen: string) => unknown;
};
const { TutorUnavailableError } = (await import(`${answerSrc}/lib/tutorErrors.ts`)) as {
  TutorUnavailableError: new (...args: never[]) => Error;
};

const KEY = "chave-interna-de-teste-123";
const model = new FakeTutorModel(validModelOutput());
const app = createApp({ tutorService: new TutorService(model, new InMemoryFeedbackRepository()), internalApiKey: KEY });
const server = app.listen(0);
await new Promise((resolveListening) => server.once("listening", resolveListening));

process.env.AI_TUTOR_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
process.env.INTERNAL_API_KEY = KEY;

// Questão no formato REAL do banco do quest-service: options = [{letter, text}], gabarito B, aluno marcou C.
const quest = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  statement: "Qual é a principal função de um banco de dados?",
  options: [
    { letter: "A", text: "Executar sistemas operacionais" },
    { letter: "B", text: "Armazenar e organizar informações" },
    { letter: "C", text: "Compilar códigos" },
  ],
  correctOption: "B",
  area: "Banco de Dados",
  source: null,
};

let failures = 0;
function check(label: string, condition: boolean, detail: string): void {
  if (!condition) failures += 1;
  console.log(`${condition ? "OK  " : "FALHA"} ${label} → ${detail}`);
}

try {
  const first = await requestTutorFeedback(toTutorRequest(quest, "C"));
  check("1ª chamada", first.feedback.resultado === "incorreto" && first.feedback.analiseAluno.alternativa === "C" && !first.cached,
    `resultado=${first.feedback.resultado} alternativa=${first.feedback.analiseAluno.alternativa} cached=${first.cached} materiais=${JSON.stringify(first.feedback.materiais)}`);

  const second = await requestTutorFeedback(toTutorRequest(quest, "C"));
  check("2ª chamada vem do cache", second.cached && model.calls === 1, `cached=${second.cached} chamadas ao modelo=${model.calls}`);

  process.env.INTERNAL_API_KEY = "chave-errada-chave-errada";
  try {
    await requestTutorFeedback(toTutorRequest(quest, "C"));
    check("chave errada é rejeitada", false, "a chave errada foi aceita");
  } catch (error) {
    check("chave errada é rejeitada", error instanceof TutorUnavailableError, error instanceof Error ? error.name : String(error));
  }
} finally {
  server.close();
}

if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exitCode = 1;
}
