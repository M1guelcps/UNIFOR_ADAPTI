import { api } from "../api/client.js";
import { anoDaFonte, normalizarArea } from "./areas.js";
import { embaralhar, normalizarOpcoes } from "./format.js";

// O GET /quests ainda não filtra por área/ano no backend, então buscamos
// um lote grande uma vez e filtramos aqui. Quando o backend aceitar
// ?area=&year=, dá para trocar esta busca por chamadas filtradas.
const LOTE = 1000;
const VALIDADE_MS = 60_000;

let cache = null; // { quando, promessa }

export function carregarBanco({ forcar = false } = {}) {
  if (!forcar && cache && Date.now() - cache.quando < VALIDADE_MS) return cache.promessa;
  const promessa = api(`/quests?page=1&limit=${LOTE}`)
    .then(({ data }) => (data || []).filter((q) => normalizarOpcoes(q.options).length >= 2))
    .catch((erro) => {
      cache = null;
      throw erro;
    });
  cache = { quando: Date.now(), promessa };
  return promessa;
}

export function filtrar(questoes, { area = "todas", ano = "todos" }) {
  return questoes.filter(
    (q) =>
      (area === "todas" || normalizarArea(q.area) === area) &&
      (ano === "todos" || anoDaFonte(q.source) === String(ano))
  );
}

export function contar(questoes, filtros) {
  return filtrar(questoes, filtros).length;
}

export async function sortearQuestoes(config) {
  const banco = await carregarBanco({ forcar: true });
  return embaralhar(filtrar(banco, config)).slice(0, config.limit);
}
