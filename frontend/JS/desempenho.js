const API_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("@adapti:token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    // Rota correta conforme seu back-end
    const response = await fetch(`${API_URL}/answers/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Erro ao buscar métricas");

    const data = await response.json();
    
    preencherDadosDesempenho(data);
    
    // Oculta o loading e exibe a grade
    document.getElementById("loading-desempenho").style.display = "none";
    document.getElementById("area-resultados").style.display = "grid";

  } catch (error) {
    console.error(error);
    document.getElementById("loading-desempenho").innerHTML = "<h2>Erro ao carregar os dados.</h2>";
  }
});

function preencherDadosDesempenho(data) {
  const { metrics, history } = data;

  // 1. Placar Geral
  document.getElementById("placar-nota").innerText = `${metrics.correct}/${metrics.totalAnswers}`;
  
  // Opcional: remover o ".0" da string "40.0%" se vier quebrado, deixando mais limpo
  const precisaoFormatada = metrics.accuracy.replace(".0", "");
  document.getElementById("placar-porcentagem").innerText = precisaoFormatada;
  
  document.getElementById("contagem-corretas").innerText = metrics.correct;
  document.getElementById("contagem-incorretas").innerText = metrics.wrong;
  
  // Como a sua API atual não retorna tempo gasto, deixamos um traço (ou você pode salvar/recuperar do localStorage depois)
  document.getElementById("contagem-tempo").innerText = "--";

  // 2. Desempenho por Área (Calculado a partir do histórico)
  const estatisticasAreas = {
    linguagens: { total: 0, corretas: 0 },
    humanas: { total: 0, corretas: 0 },
    natureza: { total: 0, corretas: 0 },
    matematica: { total: 0, corretas: 0 }
  };

  // Varre as questões respondidas para contar os acertos de cada área
  history.forEach(item => {
    // Pega a área da questão, tratando caso venha com letras maiúsculas ou minúsculas
    const area = item.quest.area.toLowerCase();
    
    if (estatisticasAreas[area] !== undefined) {
      estatisticasAreas[area].total++;
      if (item.isCorrect) {
        estatisticasAreas[area].corretas++;
      }
    }
  });

  const porcentagensAreas = {};

  const preencherArea = (nome) => {
    const stats = estatisticasAreas[nome];
    let porcentagem = 0;
    
    // Evita divisão por zero se o aluno não fez questões dessa área
    if (stats.total > 0) {
      porcentagem = Math.round((stats.corretas / stats.total) * 100);
    }
    
    porcentagensAreas[nome] = porcentagem;

    const idBarra = `barra-${nome}`;
    const idValor = `valor-${nome}`;
    
    if (document.getElementById(idBarra)) {
      document.getElementById(idBarra).style.width = `${porcentagem}%`;
      document.getElementById(idValor).innerText = `${porcentagem}%`;
    }
  };

  preencherArea("linguagens");
  preencherArea("humanas");
  preencherArea("natureza");
  preencherArea("matematica");

  // 3. Resumo (Melhor e Pior área)
  // Filtra apenas as áreas que o aluno efetivamente respondeu (total > 0)
  const areasRespondidas = Object.entries(estatisticasAreas)
    .filter(([nome, stats]) => stats.total > 0)
    .map(([nome]) => ({
      nome,
      valor: porcentagensAreas[nome]
    }));

  if (areasRespondidas.length > 0) {
    // Ordena do maior aproveitamento para o menor
    areasRespondidas.sort((a, b) => b.valor - a.valor); 

    const melhor = areasRespondidas[0];
    const pior = areasRespondidas[areasRespondidas.length - 1];
    
    const capitalizar = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    document.getElementById("resumo-melhor-area").innerText = capitalizar(melhor.nome);
    document.getElementById("resumo-melhor-detalhe").innerText = `Você teve ${melhor.valor}% de aproveitamento`;

    document.getElementById("resumo-pior-area").innerText = capitalizar(pior.nome);
    document.getElementById("resumo-pior-detalhe").innerText = `Você teve ${pior.valor}% de aproveitamento`;
  } else {
    // Fallback se o histórico estiver vazio
    document.getElementById("resumo-melhor-area").innerText = "-";
    document.getElementById("resumo-melhor-detalhe").innerText = "Sem dados suficientes";
    document.getElementById("resumo-pior-area").innerText = "-";
    document.getElementById("resumo-pior-detalhe").innerText = "Sem dados suficientes";
  }
}