
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

      const name = document.getElementById("nome").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("senha").value;
      const confirmPassword = document.getElementById("confirmar-senha").value;
      const role = document.getElementById("role").value;

      // Validar seleção de perfil
      if (!role) {
        msgErro.innerText = "Selecione um tipo de usuário.";
        msgErro.style.display = "block";
        return;
      }

      // Validar confirmação de senha
      if (password !== confirmPassword) {
        msgErro.innerText = "As senhas não coincidem.";
        msgErro.style.display = "block";
        return;
      }

      try {
        await apiRequest("/register", {
          name,
          email,
          password,
          role
        });

        msgSucesso.innerText =
          "Conta criada com sucesso! Redirecionando para o login...";

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
