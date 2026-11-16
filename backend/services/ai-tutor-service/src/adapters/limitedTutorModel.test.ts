import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TutorRateLimitedError, TutorUnavailableError } from "../domain/tutorErrors.js";
import { ConcurrencyLimiter } from "../lib/concurrencyLimiter.js";
import type { ModelCompletion, TutorModel } from "../ports/tutorModel.js";
import { LimitedTutorModel } from "./limitedTutorModel.js";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Modelo cujas chamadas ficam abertas até `release()`, contando quantas estão simultâneas. */
class SlowModel implements TutorModel {
  readonly name = "lento";
  current = 0;
  peak = 0;
  private readonly gates: Array<() => void> = [];

  async generateFeedback(): Promise<ModelCompletion> {
    this.current += 1;
    this.peak = Math.max(this.peak, this.current);
    await new Promise<void>((resolve) => this.gates.push(resolve));
    this.current -= 1;
    return { data: {}, model: this.name, usage: {} };
  }

  release(): void {
    this.gates.shift()?.();
  }
}

describe("LimitedTutorModel", () => {
  it("nunca passa do limite de chamadas simultâneas", async () => {
    const inner = new SlowModel();
    const model = new LimitedTutorModel(inner, new ConcurrencyLimiter(2, 10));

    const calls = [1, 2, 3, 4].map(() => model.generateFeedback("x"));
    await tick();
    assert.equal(inner.current, 2);

    for (let i = 0; i < 4; i++) {
      inner.release();
      await tick();
    }
    await Promise.all(calls);

    assert.equal(inner.peak, 2);
  });

  it("com a fila cheia falha rápido com TutorRateLimitedError e Retry-After", async () => {
    const inner = new SlowModel();
    const model = new LimitedTutorModel(inner, new ConcurrencyLimiter(1, 0));

    const first = model.generateFeedback("x");
    await tick();

    await assert.rejects(
      () => model.generateFeedback("x"),
      (error: unknown) => error instanceof TutorRateLimitedError && (error.retryAfterSeconds ?? 0) > 0
    );

    inner.release();
    await first;
  });

  it("repassa o resultado e o nome do modelo interno", async () => {
    const inner = new SlowModel();
    const model = new LimitedTutorModel(inner, new ConcurrencyLimiter(1, 1));

    const call = model.generateFeedback("x");
    await tick();
    inner.release();

    assert.equal((await call).model, "lento");
    assert.equal(model.name, "lento");
  });

  it("repassa os erros do modelo interno sem alterá-los", async () => {
    const failing: TutorModel = {
      name: "falho",
      async generateFeedback() {
        throw new TutorUnavailableError();
      },
    };
    const model = new LimitedTutorModel(failing, new ConcurrencyLimiter(1, 1));

    await assert.rejects(() => model.generateFeedback("x"), TutorUnavailableError);
  });
});
