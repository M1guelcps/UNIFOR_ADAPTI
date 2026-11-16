/** A fila de espera está cheia: aceitar mais uma tarefa só alongaria a espera de todos. */
export class QueueFullError extends Error {
  constructor() {
    super("Fila de espera cheia.");
    this.name = "QueueFullError";
  }
}

/**
 * Semáforo com fila limitada, sem dependências. No máximo `maxConcurrent` tarefas rodam ao mesmo tempo;
 * as demais esperam em ordem de chegada (até `maxQueue`); acima disso a tarefa é recusada na hora.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) throw new RangeError("maxConcurrent deve ser um inteiro >= 1.");
    if (!Number.isInteger(maxQueue) || maxQueue < 0) throw new RangeError("maxQueue deve ser um inteiro >= 0.");
  }

  get running(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiting.length;
  }

  /** @throws QueueFullError quando não há vaga nem lugar na fila. */
  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.waiting.length >= this.maxQueue) {
      return Promise.reject(new QueueFullError());
    }
    // A vaga é repassada diretamente a quem espera (active não muda), sem brecha para furar a fila.
    return new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.active -= 1;
    }
  }
}
