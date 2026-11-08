// As questões do ENEM chegam com a área em formatos variados
// ("matematica", "ciencias-humanas", "Ciências da Natureza"...).
// Tudo é normalizado para uma destas quatro chaves.
export const AREAS = [
  { id: "linguagens", nome: "Linguagens", nomeLongo: "Linguagens", icone: "livro.svg" },
  { id: "humanas", nome: "Humanas", nomeLongo: "Ciências Humanas", icone: "pessoas.svg" },
  { id: "natureza", nome: "Natureza", nomeLongo: "Ciências da Natureza", icone: "folha.svg" },
  { id: "matematica", nome: "Matemática", nomeLongo: "Matemática", icone: "calculadora.svg" },
];

const POR_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));

function semAcento(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function normalizarArea(area) {
  const t = semAcento(area);
  if (t.includes("matem")) return "matematica";
  if (t.includes("lingu") || t.includes("portug") || t.includes("ingles") || t.includes("espanhol")) return "linguagens";
  if (t.includes("human") || t.includes("histor") || t.includes("geograf") || t.includes("filosof") || t.includes("sociolog")) return "humanas";
  if (t.includes("natur") || t.includes("fisic") || t.includes("quimic") || t.includes("biolog")) return "natureza";
  return null;
}

export function nomeArea(area) {
  const id = normalizarArea(area);
  return id ? POR_ID[id].nome : area || "Geral";
}

export function infoArea(area) {
  return POR_ID[normalizarArea(area)] ?? null;
}

// "ENEM 2023" -> "2023"
export function anoDaFonte(fonte) {
  const m = String(fonte ?? "").match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}
