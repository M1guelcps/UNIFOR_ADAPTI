import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const INTERNAL_KEY_HEADER = "x-internal-api-key";

// Compara os digests (tamanho fixo) em vez das chaves: timingSafeEqual exige buffers do mesmo tamanho
// e assim o tamanho da chave real também não vaza pelo tempo de resposta.
const digest = (value: string) => createHash("sha256").update(value).digest();

/** Libera a rota apenas para chamadas de outros serviços do Adapti que conheçam a chave interna. */
export function createInternalAuth(expectedKey: string) {
  const expectedDigest = digest(expectedKey);

  return (req: Request, res: Response, next: NextFunction) => {
    const received = req.header(INTERNAL_KEY_HEADER);

    if (!received || !timingSafeEqual(digest(received), expectedDigest)) {
      return res.status(401).json({ error: "Chamada interna não autorizada." });
    }

    return next();
  };
}
