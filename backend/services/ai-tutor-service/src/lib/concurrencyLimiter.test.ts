import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConcurrencyLimiter, QueueFullError } from "./concurrencyLimiter.js";

/** Tarefa que só termina quando `finish()` é chamado, para observar quantas rodam ao mesmo tempo. */
function controllableTask() {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  return { finish, run: () => gate };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("ConcurrencyLimiter", () => {
  it("roda até maxConcurrent tarefas ao mesmo tempo e enfileira as demais", async () => {
    const limiter = new ConcurrencyLimiter(2, 10);
    const tasks = [controllableTask(), controllableTask(), controllableTask()];

    const results = tasks.map((task) => limiter.run(task.run));
    await tick();

    assert.equal(limiter.running, 2);
    assert.equal(limiter.queued, 1);

    tasks[0]!.finish();
    await tick();
    assert.equal(limiter.running, 2);
    assert.equal(limiter.queued, 0);

    tasks[1]!.finish();
    tasks[2]!.finish();
    await Promise.all(results);
    assert.equal(limiter.running, 0);
  });

  it("atende a fila em ordem de chegada", async () => {
    const limiter = new ConcurrencyLimiter(1, 10);
    const order: number[] = [];
    const first = controllableTask();

    const all = [
      limiter.run(async () => {
        await first.run();
        order.push(1);
      }),
      limiter.run(async () => void order.push(2)),
      limiter.run(async () => void order.push(3)),
    ];
    await tick();
    first.finish();
    await Promise.all(all);

    assert.deepEqual(order, [1, 2, 3]);
  });

  it("recusa na hora com QueueFullError quando a fila está cheia", async () => {
    const limiter = new ConcurrencyLimiter(1, 1);
    const running = controllableTask();
    const queued = controllableTask();

    const first = limiter.run(running.run);
    const second = limiter.run(queued.run);
    await tick();

    await assert.rejects(() => limiter.run(async () => "terceira"), QueueFullError);

    running.finish();
    queued.finish();
    await Promise.all([first, second]);
  });

  it("com maxQueue 0 não enfileira nada", async () => {
    const limiter = new ConcurrencyLimiter(1, 0);
    const running = controllableTask();
    const first = limiter.run(running.run);
    await tick();

    await assert.rejects(() => limiter.run(async () => "x"), QueueFullError);

    running.finish();
    await first;
  });

  it("libera a vaga quando a tarefa falha", async () => {
    const limiter = new ConcurrencyLimiter(1, 0);

    await assert.rejects(() => limiter.run(async () => { throw new Error("falhou"); }), /falhou/);

    assert.equal(limiter.running, 0);
    assert.equal(await limiter.run(async () => "ok"), "ok");
  });

  it("rejeita limites inválidos", () => {
    assert.throws(() => new ConcurrencyLimiter(0, 1), RangeError);
    assert.throws(() => new ConcurrencyLimiter(1, -1), RangeError);
  });
});
