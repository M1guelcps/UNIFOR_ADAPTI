export const LETRAS = ["A", "B", "C", "D", "E"];

export function primeiroNome(nome) {
  return String(nome ?? "").trim().split(/\s+/)[0] || "";
}

// "40.0%" -> "40%"
export function limparPercentual(valor) {
  return String(valor ?? "0%").replace(".0%", "%");
}

export function percentual(parte, total) {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export function formatarData(iso) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "-";
}

export function formatarDataHora(iso) {
  return iso
    ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "-";
}

export function formatarTempo(segundos) {
  const s = Math.max(0, Math.round(segundos || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const doisDigitos = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${doisDigitos(m)}:${doisDigitos(seg)}` : `${doisDigitos(m)}:${doisDigitos(seg)}`;
}

export function formatarDuracao(segundos) {
  if ((segundos || 0) < 60) return "menos de 1 min";
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}min`;
}

// Enunciados do ENEM vêm com markdown e imagens; nas listas mostramos um resumo.
export function resumirTexto(texto, max = 110) {
  const limpo = String(texto ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[imagem]")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return limpo.length > max ? `${limpo.slice(0, max)}…` : limpo;
}

// Alternativas podem vir como texto puro ou como { letter, text, file }.
export function normalizarOpcoes(options) {
  return (Array.isArray(options) ? options : []).map((op, i) => {
    if (typeof op === "string") return { letra: LETRAS[i] ?? String(i + 1), texto: op, imagem: null };
    return {
      letra: String(op.letter || LETRAS[i] || i + 1).toUpperCase(),
      texto: op.text ?? op.description ?? op.body ?? "",
      imagem: op.file || null,
    };
  });
}

export function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
