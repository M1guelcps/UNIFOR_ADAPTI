const API_URL = "http://localhost:3000";
let questoes = [];
let indiceAtual = 0;
let timerInterval;
let segundosCorridos = 0;

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("@adapti:token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // 1. Resgata as configurações escolhidas na tela anterior
  const configSalva = localStorage.getItem("@adapti:configPratica");
  const config = configSalva ? JSON.parse(configSalva) : { limit: 10, area: "todas", ano: "todos", cronometro: false };

  // 2. Monta a URL da API baseada nos filtros
  // Exemplo prático: se não for "todas", adiciona o filtro na URL
  let url = `${API_URL}/quests?limit=${config.limit}`;
  if (config.area && config.area !== "todas") url += `&area=${config.area}`;
  if (config.ano && config.ano !== "todos") url += `&year=${config.ano}`;

  try {
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const result = await response.json();
    
    // Dependendo da sua API, pode ser result ou result.data
    questoes = result.data || result;

    if (questoes.length > 0) {
      document.getElementById("loading").style.display = "none";
      document.getElementById("area-questao").style.display = "block";
      
      if (config.cronometro) iniciarCronometro();
      
      renderizarQuestao();
    } else {
      document.getElementById("loading").innerHTML = "<h2>Nenhuma questão encontrada com esses filtros.</h2>";
    }
  } catch (error) {
    console.error("Erro ao buscar questões:", error);
    document.getElementById("loading").innerHTML = "<h2>Erro ao conectar com o servidor.</h2>";
  }

  // Eventos de Navegação e Resposta
  document.getElementById("btn-anterior").addEventListener("click", () => {
    if (indiceAtual > 0) {
      indiceAtual--;
      renderizarQuestao();
    }
  });

  document.getElementById("btn-proxima").addEventListener("click", () => {
    if (indiceAtual < questoes.length - 1) {
      indiceAtual++;
      renderizarQuestao();
    } else {
      alert("Prática finalizada! Redirecionando para o desempenho...");
      window.location.href = "desempenho.html";
    }
  });

  document.getElementById("form-respostas").addEventListener("submit", responderQuestao);
});

function renderizarQuestao() {
  const questao = questoes[indiceAtual];
  
  // Topo e Progresso
  document.getElementById("titulo-questao").innerText = `Questão ${indiceAtual + 1} de ${questoes.length}`;
  const progresso = ((indiceAtual + 1) / questoes.length) * 100;
  document.getElementById("barra-progresso").style.width = `${progresso}%`;

  // Enunciado
  document.getElementById("etiqueta-questao").innerHTML = `
    <span class="estatistica-icone"><img src="../assets/desempenho.svg" alt=""></span> 
    ${questao.area.toUpperCase()} - ENEM ${questao.year || "2023"}
  `;
  document.getElementById("texto-enunciado").innerHTML = `<p>${questao.statement}</p>`;
  
  // Alternativas
  const containerAlt = document.getElementById("container-alternativas");
  // Mantemos o legend
  containerAlt.innerHTML = `<legend id="texto-pergunta">Selecione a alternativa correta:</legend>`;

  questao.options.forEach((opcao, index) => {
        const letra = String.fromCharCode(65 + index); // A, B, C, D, E
        const label = document.createElement("label");
        label.className = "alternativa";
        
        // Vamos dar um console.log para você ver a estrutura no F12 do navegador!
        console.log("Estrutura da opção:", opcao); 

        // AJUSTE AQUI: Se a sua API usa 'text', 'body' ou 'description' para o texto da alternativa
        // Tente descobrir qual é olhando o console. Vou colocar 'opcao.text' como exemplo:
        const textoDaOpcao = opcao.text || opcao.description || opcao.body || opcao.conteudo || "Texto não encontrado";
        
        // O value agora será o ID da opção (se sua API validar por ID) ou a letra que a API espera
        const valorResposta = opcao.id || letra.toLowerCase(); 

        label.innerHTML = `
          <input type="radio" name="resposta" value="${valorResposta}">
          <span><b>${letra}</b>${textoDaOpcao}</span>
        `;
        containerAlt.appendChild(label);
      });

  // Configuração de botões
  document.getElementById("btn-responder").style.display = "inline-block";
  document.getElementById("btn-responder").disabled = false;
  document.getElementById("btn-responder").innerText = "Responder";
  document.getElementById("btn-proxima").style.display = "none";
  
  const btnAnterior = document.getElementById("btn-anterior");
  btnAnterior.style.visibility = indiceAtual === 0 ? "hidden" : "visible";
}

async function responderQuestao(e) {
  e.preventDefault();
  const selecionada = document.querySelector('input[name="resposta"]:checked');
  
  if (!selecionada) {
    alert("Selecione uma alternativa!");
    return;
  }

  const questao = questoes[indiceAtual];
  const btnResponder = document.getElementById("btn-responder");
  btnResponder.innerText = "Validando...";
  btnResponder.disabled = true;

  try {
        const token = localStorage.getItem("@adapti:token");
        const response = await fetch(`${API_URL}/answers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            questId: questao.id,
            selectedOption: selecionada.value // Chave corrigida aqui
          })
        });

    const result = await response.json();

    // Estilização visual da resposta correta/errada
    const labels = document.querySelectorAll(".alternativa");
    labels.forEach(label => {
      const input = label.querySelector("input");
      input.disabled = true; // Bloqueia troca de resposta
      
      if (input.value === result.correctAnswer) {
        label.style.borderColor = "green";
        label.style.backgroundColor = "#e8f5e9";
      } else if (input.checked && !result.isCorrect) {
        label.style.borderColor = "red";
        label.style.backgroundColor = "#ffebee";
      }
    });

    // Troca os botões
    btnResponder.style.display = "none";
    document.getElementById("btn-proxima").style.display = "inline-block";
    document.getElementById("btn-proxima").innerText = 
      indiceAtual === questoes.length - 1 ? "Finalizar Prática" : "Próxima";

  } catch (error) {
    alert("Erro ao enviar resposta.");
    btnResponder.innerText = "Responder";
    btnResponder.disabled = false;
  }
}

function iniciarCronometro() {
  document.getElementById("relogio-container").style.display = "inline-block";
  timerInterval = setInterval(() => {
    segundosCorridos++;
    const min = Math.floor(segundosCorridos / 60).toString().padStart(2, "0");
    const seg = (segundosCorridos % 60).toString().padStart(2, "0");
    document.getElementById("tempo-corrido").innerText = `${min}:${seg}`;
  }, 1000);
}