import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeContentHash, computePromptFingerprint } from "../domain/contentHash.js";
import {
  TutorInvalidOutputError,
  TutorRateLimitedError,
  TutorUnavailableError,
} from "../domain/tutorErrors.js";
import type { ModelCompletion, TutorModel } from "../ports/tutorModel.js";
import { PROMPT_VERSION } from "../prompts/tutorPrompt.js";
import { FakeTutorModel, InMemoryFeedbackRepository, InMemoryMaterialCatalog, validModelOutput, validRequest } from "../testing/fakes.js";
import { TutorService } from "./tutorService.js";

function build(...script: unknown[]) {
  const model = new FakeTutorModel(...script);
  const repository = new InMemoryFeedbackRepository();
  return { model, repository, service: new TutorService(model, repository) };
}

describe("TutorService.explain", () => {
  it("marca 'incorreto' e analisa a alternativa do aluno quando ele errou", async () => {
    const { service } = build(validModelOutput());

    const { feedback, cached } = await service.explain(validRequest({ respostaCorreta: "B", respostaAluno: "C" }));

    assert.equal(feedback.resultado, "incorreto");
    assert.equal(feedback.analiseAluno.alternativa, "C");
    assert.equal(cached, false);
  });

  it("marca 'correto' quando o aluno acertou", async () => {
    const { service } = build(validModelOutput());

    const { feedback } = await service.explain(validRequest({ respostaCorreta: "B", respostaAluno: "B" }));

    assert.equal(feedback.resultado, "correto");
    assert.equal(feedback.analiseAluno.alternativa, "B");
  });

  it("ignora um 'resultado' enviado pelo modelo: a correção é do servidor", async () => {
    const lyingModel = { ...validModelOutput(), resultado: "correto" };
    const { service } = build(lyingModel);

    const { feedback } = await service.explain(validRequest({ respostaCorreta: "B", respostaAluno: "C" }));

    assert.equal(feedback.resultado, "incorreto");
  });

  it("nunca devolve materiais, mesmo que o modelo invente links", async () => {
    const withInventedLinks = { ...validModelOutput(), materiais: [{ titulo: "x", url: "https://falso.example", descricao: "y" }] };
    const { service } = build(withInventedLinks);

    const { feedback } = await service.explain(validRequest());

    assert.deepEqual(feedback.materiais, []);
  });

  it("não envia questaoId nem dados do aluno ao modelo", async () => {
    const { model, service } = build(validModelOutput());

    await service.explain(validRequest());

    assert.equal(model.contents[0]?.includes("550e8400"), false);
  });

  it("grava o feedback no cache com a versão do prompt e o nome do modelo", async () => {
    const { repository, service } = build(validModelOutput());
    const request = validRequest();

    await service.explain(request);

    const saved = repository.entries.get(computeContentHash(request));
    assert.equal(saved?.promptVersion, PROMPT_VERSION);
    assert.equal(saved?.model, "fake-model");
    assert.equal(saved?.questaoId, request.questaoId);
  });

  it("serve do cache sem chamar o modelo na segunda vez", async () => {
    const { model, service } = build(validModelOutput());

    await service.explain(validRequest());
    const second = await service.explain(validRequest());

    assert.equal(second.cached, true);
    assert.equal(model.calls, 1);
  });

  it("reaproveita a tutoria entre questões idênticas de IDs diferentes", async () => {
    const { model, service } = build(validModelOutput());

    await service.explain(validRequest());
    const other = await service.explain(validRequest({ questaoId: "6f1c3f0e-5b7a-4c1d-9a55-1c2d3e4f5a6b" }));

    assert.equal(other.cached, true);
    assert.equal(model.calls, 1);
  });

  it("gera de novo quando o enunciado muda (hash diferente)", async () => {
    const { model, service } = build(validModelOutput(), validModelOutput());

    await service.explain(validRequest());
    const edited = await service.explain(validRequest({ enunciado: "Enunciado editado pelo professor." }));

    assert.equal(edited.cached, false);
    assert.equal(model.calls, 2);
  });

  it("gera de novo quando o aluno marca outra alternativa errada", async () => {
    const { model, service } = build(validModelOutput(), validModelOutput());

    await service.explain(validRequest({ respostaAluno: "C" }));
    await service.explain(validRequest({ respostaAluno: "D" }));

    assert.equal(model.calls, 2);
  });

  it("tenta de novo uma vez quando o modelo devolve JSON fora do esquema", async () => {
    const { model, service } = build({ explicacao: "faltam campos" }, validModelOutput());

    const { feedback } = await service.explain(validRequest());

    assert.equal(model.calls, 2);
    assert.equal(feedback.resultado, "incorreto");
  });

  it("desiste com TutorInvalidOutputError depois de duas saídas inválidas", async () => {
    const { model, service } = build({ lixo: true }, { lixo: true }, validModelOutput());

    await assert.rejects(() => service.explain(validRequest()), TutorInvalidOutputError);
    assert.equal(model.calls, 2);
  });

  it("repassa 429 imediatamente, sem nova tentativa", async () => {
    const { model, service } = build(new TutorRateLimitedError(12), validModelOutput());

    await assert.rejects(
      () => service.explain(validRequest()),
      (error: unknown) => error instanceof TutorRateLimitedError && error.retryAfterSeconds === 12
    );
    assert.equal(model.calls, 1);
  });

  it("repassa indisponibilidade do provedor sem gravar nada no cache", async () => {
    const { repository, service } = build(new TutorUnavailableError());

    await assert.rejects(() => service.explain(validRequest()), TutorUnavailableError);
    assert.equal(repository.entries.size, 0);
  });

  it("entrega a tutoria mesmo se o banco falhar ao ler e ao gravar o cache", async () => {
    const { repository, service } = build(validModelOutput());
    repository.failOnFind = true;
    repository.failOnSave = true;

    const { feedback, cached } = await service.explain(validRequest());

    assert.equal(feedback.resultado, "incorreto");
    assert.equal(cached, false);
  });
});

/** Modelo que só responde quando `release()` é chamado: permite chegar pedidos enquanto a geração está aberta. */
class GatedModel implements TutorModel {
  readonly name = "principal";
  calls = 0;
  private readonly gates: Array<(outcome: ModelCompletion | Error) => void> = [];

  constructor(private readonly respondingModel = "principal") {}

  generateFeedback(): Promise<ModelCompletion> {
    this.calls += 1;
    return new Promise((resolve, reject) => {
      this.gates.push((outcome) => (outcome instanceof Error ? reject(outcome) : resolve(outcome)));
    });
  }

  release(outcome?: Error): void {
    this.gates.shift()?.(outcome ?? { data: validModelOutput(), model: this.respondingModel, usage: {} });
  }
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("TutorService: pedidos idênticos simultâneos", () => {
  it("agrupa em uma única chamada ao modelo e marca o segundo como cached", async () => {
    const model = new GatedModel();
    const service = new TutorService(model, new InMemoryFeedbackRepository());

    const first = service.explain(validRequest());
    await tick();
    const second = service.explain(validRequest({ questaoId: "6f1c3f0e-5b7a-4c1d-9a55-1c2d3e4f5a6b" }));
    await tick();
    model.release();
    const [a, b] = await Promise.all([first, second]);

    assert.equal(model.calls, 1);
    assert.equal(a.cached, false);
    assert.equal(b.cached, true);
    assert.deepEqual(a.feedback, b.feedback);
  });

  it("não agrupa questões diferentes", async () => {
    const model = new GatedModel();
    const service = new TutorService(model, new InMemoryFeedbackRepository());

    const first = service.explain(validRequest({ respostaAluno: "C" }));
    const second = service.explain(validRequest({ respostaAluno: "D" }));
    await tick();
    model.release();
    model.release();
    await Promise.all([first, second]);

    assert.equal(model.calls, 2);
  });

  it("propaga a mesma falha a quem esperava e libera o hash para a próxima tentativa", async () => {
    const model = new GatedModel();
    const service = new TutorService(model, new InMemoryFeedbackRepository());

    const first = service.explain(validRequest());
    await tick();
    const second = service.explain(validRequest());
    await tick();
    model.release(new TutorUnavailableError());
    const outcomes = await Promise.allSettled([first, second]);

    assert.deepEqual(outcomes.map((outcome) => outcome.status), ["rejected", "rejected"]);
    assert.equal(model.calls, 1);

    const retry = service.explain(validRequest());
    await tick();
    model.release();
    assert.equal((await retry).cached, false);
    assert.equal(model.calls, 2);
  });
});

describe("TutorService: modelo gravado no cache", () => {
  it("grava o modelo que de fato respondeu (o reserva), não o principal", async () => {
    const model = new GatedModel("modelo-reserva");
    const repository = new InMemoryFeedbackRepository();
    const service = new TutorService(model, repository);
    const request = validRequest();

    const pending = service.explain(request);
    await tick();
    model.release();
    await pending;

    assert.equal(repository.entries.get(computeContentHash(request))?.model, "modelo-reserva");
  });
});

describe("TutorService: catálogo de materiais", () => {
  const porcentagem1 = { disciplina: "matematica", assunto: "Porcentagem", titulo: "Porcentagem passo a passo", url: "https://exemplo.test/porcentagem", descricao: "Cálculo de porcentagens." };
  const porcentagem2 = { disciplina: "matematica", assunto: "Porcentagem", titulo: "Aumentos e descontos", url: "https://exemplo.test/descontos", descricao: "Aumentos e descontos sucessivos." };
  const regraDeTres = { disciplina: "matematica", assunto: "Regra de três", titulo: "Regra de três", url: "https://exemplo.test/regra-de-tres", descricao: "Grandezas proporcionais." };

  // A disciplina chega do Answer Service como "Matemática" ou "matematica": o catálogo normaliza as duas.
  const mathRequest = (overrides = {}) => validRequest({ disciplina: "Matemática", ...overrides });

  function buildWithCatalog(modelOutput: unknown, materials = [porcentagem1, porcentagem2, regraDeTres]) {
    const model = new FakeTutorModel(modelOutput, validModelOutput());
    const repository = new InMemoryFeedbackRepository();
    const catalog = new InMemoryMaterialCatalog(materials);
    return { model, repository, catalog, service: new TutorService(model, repository, catalog) };
  }

  it("oferece ao modelo só os assuntos do catálogo da disciplina e devolve os materiais dos assuntos escolhidos", async () => {
    const { model, service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] });

    const { feedback } = await service.explain(mathRequest());

    // Ordem estável: por assunto e, dentro dele, por título ("Aumentos…" vem antes de "Porcentagem…").
    assert.deepEqual(feedback.materiais.map((m) => m.url), [porcentagem2.url, porcentagem1.url]);
    assert.match(model.contents[0] ?? "", /"assuntosDoCatalogo": \[\s*"Porcentagem",\s*"Regra de três"\s*\]/);
  });

  it("descarta assuntos que não estão na lista (inclusive links inventados) e aceita grafia sem acento", async () => {
    const { service } = buildWithCatalog({
      ...validModelOutput(),
      assuntos: ["Assunto inventado", "https://falso.example", "regra de tres", "REGRA DE TRÊS"],
    });

    const { feedback } = await service.explain(mathRequest());

    assert.deepEqual(feedback.materiais.map((m) => m.url), [regraDeTres.url]);
  });

  it("corta em 3 assuntos mesmo que o modelo devolva mais", async () => {
    const topics = ["Assunto A", "Assunto B", "Assunto C", "Assunto D"];
    const materials = topics.map((assunto, i) => ({ ...porcentagem1, assunto, titulo: assunto, url: `https://exemplo.test/${i}` }));
    const { repository, service } = buildWithCatalog({ ...validModelOutput(), assuntos: topics }, materials);
    const request = mathRequest();

    const { feedback } = await service.explain(request);

    assert.deepEqual(feedback.materiais.map((m) => m.titulo), ["Assunto A", "Assunto B", "Assunto C"]);
    assert.equal(repository.entries.get(computeContentHash(request, topics))?.assuntos.length, 3);
  });

  it("devolve materiais vazios quando o modelo não escolhe assunto algum", async () => {
    const { service } = buildWithCatalog({ ...validModelOutput(), assuntos: [] });

    assert.deepEqual((await service.explain(mathRequest())).feedback.materiais, []);
  });

  it("limita a 5 materiais, em ordem estável", async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...porcentagem1, titulo: `Material ${i}`, url: `https://exemplo.test/m${i}` }));
    const { service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] }, many);

    const { feedback } = await service.explain(mathRequest());

    assert.deepEqual(feedback.materiais.map((m) => m.titulo), ["Material 0", "Material 1", "Material 2", "Material 3", "Material 4"]);
  });

  it("grava no cache só os assuntos, nunca os links", async () => {
    const { repository, service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] });
    const request = mathRequest();

    await service.explain(request);

    const saved = repository.entries.get(computeContentHash(request, ["Porcentagem", "Regra de três"]));
    assert.deepEqual(saved?.assuntos, ["Porcentagem"]);
    assert.deepEqual(saved?.feedback.materiais, []);
  });

  it("resolve os materiais no catálogo também quando a tutoria vem do cache: material novo aparece sem gerar de novo", async () => {
    const { model, catalog, service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] }, [porcentagem1, regraDeTres]);

    const first = await service.explain(mathRequest());
    catalog.add({ ...porcentagem2 });
    const second = await service.explain(mathRequest());

    assert.equal(second.cached, true);
    assert.equal(model.calls, 1);
    assert.equal(first.feedback.materiais.length, 1);
    assert.equal(second.feedback.materiais.length, 2);
  });

  it("gera de novo quando a lista de assuntos do catálogo muda (o modelo pode escolher o assunto novo)", async () => {
    const { model, catalog, service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] }, [porcentagem1]);

    await service.explain(mathRequest());
    catalog.add({ ...regraDeTres });
    const second = await service.explain(mathRequest());

    assert.equal(second.cached, false);
    assert.equal(model.calls, 2);
  });

  it("entrega a tutoria sem links quando o catálogo falha ao buscar os materiais", async () => {
    const { catalog, service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] });
    catalog.failOnFindMaterials = true;

    const { feedback } = await service.explain(mathRequest());

    assert.equal(feedback.resultado, "incorreto");
    assert.deepEqual(feedback.materiais, []);
  });

  it("entrega a tutoria sem oferecer assuntos quando o catálogo falha ao listá-los", async () => {
    const { model, catalog, service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] });
    catalog.failOnListTopics = true;

    const { feedback } = await service.explain(mathRequest());

    assert.deepEqual(feedback.materiais, []);
    assert.equal(model.contents[0]?.includes("assuntosDoCatalogo"), false);
  });

  it("não oferece assuntos nem consulta materiais quando a questão não tem disciplina", async () => {
    const { model, catalog, service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] });

    const { feedback } = await service.explain(validRequest({ disciplina: undefined }));

    assert.deepEqual(feedback.materiais, []);
    assert.equal(model.contents[0]?.includes("assuntosDoCatalogo"), false);
    assert.equal(catalog.findCalls, 0);
  });

  it("não mistura disciplinas: matemática não recebe materiais de linguagens", async () => {
    const linguagens = { disciplina: "linguagens", assunto: "Porcentagem", titulo: "Intruso", url: "https://exemplo.test/intruso", descricao: "x" };
    const { service } = buildWithCatalog({ ...validModelOutput(), assuntos: ["Porcentagem"] }, [porcentagem1, linguagens]);

    const { feedback } = await service.explain(mathRequest());

    assert.deepEqual(feedback.materiais.map((m) => m.url), [porcentagem1.url]);
  });
});

describe("computePromptFingerprint", () => {
  const schema = { type: "object", properties: { a: { type: "string" } } };

  it("é estável para o mesmo prompt e schema", () => {
    assert.equal(computePromptFingerprint("prompt", schema), computePromptFingerprint("prompt", schema));
  });

  it("muda quando o texto do prompt muda, sem depender de PROMPT_VERSION", () => {
    assert.notEqual(computePromptFingerprint("prompt", schema), computePromptFingerprint("prompt editado", schema));
  });

  it("muda quando o JSON Schema da resposta muda", () => {
    assert.notEqual(
      computePromptFingerprint("prompt", schema),
      computePromptFingerprint("prompt", { ...schema, required: ["a"] })
    );
  });
});

describe("computeContentHash", () => {
  it("é estável para a mesma questão", () => {
    assert.equal(computeContentHash(validRequest()), computeContentHash(validRequest()));
  });

  it("muda quando a lista de assuntos do catálogo muda", () => {
    assert.notEqual(computeContentHash(validRequest(), ["Porcentagem"]), computeContentHash(validRequest(), ["Porcentagem", "Regra de três"]));
    assert.notEqual(computeContentHash(validRequest(), ["Porcentagem"]), computeContentHash(validRequest()));
  });

  it("muda quando o texto de uma alternativa muda", () => {
    const edited = validRequest({
      alternativas: [
        { letra: "A", texto: "Executar sistemas operacionais" },
        { letra: "B", texto: "Armazenar informações" },
        { letra: "C", texto: "Compilar códigos" },
        { letra: "D", texto: "Gerenciar componentes físicos" },
      ],
    });

    assert.notEqual(computeContentHash(edited), computeContentHash(validRequest()));
  });
});
