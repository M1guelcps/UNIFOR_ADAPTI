// Histórico das práticas/simulados concluídos.
// O backend ainda não tem o conceito de "simulado" nem guarda o tempo gasto,
// então esse resumo fica no navegador, separado por usuário.
const MAX_SESSOES = 30;

function chave(userId) {
  return `@adapti:praticas:${userId}`;
}

export function listarPraticas(userId) {
  if (!userId) return [];
  try {
    const lista = JSON.parse(localStorage.getItem(chave(userId)) || "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function salvarPratica(userId, pratica) {
  if (!userId) return;
  try {
    const lista = [pratica, ...listarPraticas(userId)].slice(0, MAX_SESSOES);
    localStorage.setItem(chave(userId), JSON.stringify(lista));
  } catch {
    // armazenamento cheio ou bloqueado: o resumo só não fica salvo
  }
}

// Configuração escolhida na tela "Configurar prática" (sobrevive a um F5 na prática)
const CONFIG_KEY = "@adapti:configPratica";

export const CONFIG_PADRAO = { modo: "questoes", area: "todas", ano: "todos", limit: 10, cronometro: true };

export function lerConfig() {
  try {
    return { ...CONFIG_PADRAO, ...JSON.parse(sessionStorage.getItem(CONFIG_KEY) || localStorage.getItem(CONFIG_KEY) || "{}") };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

export function salvarConfig(config) {
  try {
    sessionStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignora
  }
}
