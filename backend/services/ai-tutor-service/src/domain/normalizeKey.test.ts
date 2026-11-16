import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeKey } from "./normalizeKey.js";

describe("normalizeKey", () => {
  it("remove acentos e passa para minúsculas", () => {
    assert.equal(normalizeKey("Matemática"), "matematica");
    assert.equal(normalizeKey("Linguagens, Códigos e suas Tecnologias"), "linguagens-codigos-e-suas-tecnologias");
  });

  it("troca espaços e pontuação por um único hífen", () => {
    assert.equal(normalizeKey("Ciências da   Natureza"), "ciencias-da-natureza");
    assert.equal(normalizeKey("  Banco de Dados!  "), "banco-de-dados");
  });

  it("não altera uma chave que já está normalizada", () => {
    assert.equal(normalizeKey("ciencias-natureza"), "ciencias-natureza");
    assert.equal(normalizeKey(normalizeKey("Ciências Humanas")), "ciencias-humanas");
  });

  it("devolve texto vazio quando não sobra nenhum caractere útil", () => {
    assert.equal(normalizeKey("  ---  "), "");
  });
});
