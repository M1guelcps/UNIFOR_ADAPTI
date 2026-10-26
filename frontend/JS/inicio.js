document.addEventListener("DOMContentLoaded", async () => {
  // 1. Recupera o token e os dados do usuário salvos no localStorage (vindos do Login)
  // 2. Ajustado para buscar as chaves com o prefixo @adapti:
  const token = localStorage.getItem("@adapti:token");
  const userStr = localStorage.getItem("@adapti:user");

  // Se não houver token, redireciona para a tela de login
  if (!token) {
    window.location.href = "login.html"; // Ajuste para o caminho real da sua tela de login
    return;
  }

  // 2. Atualiza o nome do usuário na interface
  if (userStr) {
    const user = JSON.parse(userStr);
    // Pega apenas o primeiro nome
    const firstName = user.name.split(" ")[0]; 
    document.getElementById("user-name").textContent = `Olá, ${firstName} 👋`;
  }

  // 3. Busca as métricas de desempenho no Gateway (Answer Service)
  try {
    const response = await fetch("http://localhost:3000/answers/me", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // Injeta o token JWT de forma segura
      }
    });

    if (response.status === 401) {
      // Token expirou ou é inválido: limpa o storage e manda para o login
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    if (response.ok) {
      const data = await response.json();
      
      // 4. Atualiza o DOM com as estatísticas vindas do banco de dados
      document.getElementById("stat-total").textContent = data.metrics.totalAnswers;
      document.getElementById("stat-accuracy").textContent = data.metrics.accuracy;

      // Desafio extra: Se houver histórico, atualizar a aba de "Último resultado"
      if (data.history && data.history.length > 0) {
        const lastAnswer = data.history[0]; // Pega a resposta mais recente
        const resultText = document.querySelector(".resultado-detalhe");
        
        if (resultText) {
          resultText.textContent = lastAnswer.isCorrect 
            ? "Você acertou a última questão! 🎉" 
            : "Você errou a última questão. Vamos revisar? 💪";
        }
      }
    } else {
      console.error("Erro na resposta da API:", await response.text());
    }
  } catch (error) {
    console.error("Erro de conexão ao buscar métricas:", error);
  }

    // Captura o botão de logout
    const btnLogout = document.getElementById("btn-logout");

    if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
        e.preventDefault(); // Evita que o link tente navegar para "#"
        
        // Remove apenas as chaves da nossa aplicação (mais seguro que localStorage.clear() 
        // caso o domínio compartilhe outras coisas no futuro)
        localStorage.removeItem("@adapti:token");
        localStorage.removeItem("@adapti:user");
        
        // Redireciona para a tela de login
        window.location.href = "login.html";
    });
    }
});