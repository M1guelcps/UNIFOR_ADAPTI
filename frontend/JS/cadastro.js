document.addEventListener("DOMContentLoaded", () => {
  const formCadastro = document.getElementById("form-cadastro");
  const msgErro = document.getElementById("mensagem-erro");
  const msgSucesso = document.getElementById("mensagem-sucesso");

  // Alternar visibilidade da senha
  document.querySelectorAll(".olho").forEach((olho) => {
    olho.addEventListener("click", (e) => {
      const input = e.target.previousElementSibling;
      if (input && input.tagName === "INPUT") {
        input.type = input.type === "password" ? "text" : "password";
      }
    });
  });

  if (formCadastro) {
    formCadastro.addEventListener("submit", async (e) => {
      e.preventDefault();
      msgErro.style.display = "none";
      msgSucesso.style.display = "none";

      const name = document.getElementById("nome").value;
      const email = document.getElementById("email").value;
      const password = document.getElementById("senha").value;
      const confirmPassword = document.getElementById("confirmar-senha").value;

      if (password !== confirmPassword) {
        msgErro.innerText = "As senhas não coincidem.";
        msgErro.style.display = "block";
        return;
      }

      try {
        await apiRequest("/register", { name, email, password });
        
        msgSucesso.innerText = "Conta criada com sucesso! Redirecionando para o login...";
        msgSucesso.style.display = "block";

        setTimeout(() => {
          window.location.href = "login.html";
        }, 2000);
      } catch (error) {
        msgErro.innerText = error.message;
        msgErro.style.display = "block";
      }
    });
  }
});