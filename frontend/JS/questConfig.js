document.addEventListener("DOMContentLoaded", () => {
  // 1. Verifica se o usuário está autenticado
  const token = localStorage.getItem("@adapti:token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // 2. Seleciona o formulário usando a classe
  const formConfiguracao = document.querySelector(".configuracao");

  if (formConfiguracao) {
    formConfiguracao.addEventListener("submit", (e) => {
      e.preventDefault(); // Impede o envio padrão para podermos processar os dados

      // 3. Captura os valores marcados pelo usuário
      const modoSelecionado = document.querySelector('input[name="modo"]:checked').value;
      const areaSelecionada = document.querySelector('input[name="area"]:checked').value;
      const anoSelecionado = document.querySelector('input[name="ano"]:checked').value;
      const quantidadeSelecionada = document.querySelector('input[name="quantidade"]:checked').value;
      
      // O cronômetro é um checkbox, então pegamos a propriedade 'checked' (true ou false)
      const cronometroAtivo = document.querySelector('input[name="cronometro"]').checked;

      // 4. Monta o objeto de configuração
      const configPratica = {
        modo: modoSelecionado,
        area: areaSelecionada,
        ano: anoSelecionado,
        limit: parseInt(quantidadeSelecionada, 10),
        cronometro: cronometroAtivo
      };

      // 5. Salva no navegador para a página questao.html poder ler
      localStorage.setItem("@adapti:configPratica", JSON.stringify(configPratica));

      // 6. Redireciona para a página de resolução
      // Pega o destino direto do atributo action="questao.html"
      const destino = formConfiguracao.getAttribute("action");
      window.location.href = destino;
    });
  }
});