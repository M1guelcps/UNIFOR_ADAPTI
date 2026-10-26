document.addEventListener("DOMContentLoaded", () => {
  const formLogin = document.getElementById("form-login");
  const msgErro = document.getElementById("mensagem-erro");

  // Alternar visibilidade da senha
  document.querySelectorAll(".olho").forEach((olho) => {
    olho.addEventListener("click", (e) => {
      const input = e.target.previousElementSibling;
      if (input && input.tagName === "INPUT") {
        input.type = input.type === "password" ? "text" : "password";
      }
    });
  });

  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      msgErro.style.display = "none";

      const email = document.getElementById("email").value;
      const password = document.getElementById("senha").value;

      try {
        const data = await apiRequest("/login", { email, password });
        
        // Armazena o token JWT e dados do usuário no localStorage
        localStorage.setItem("@adapti:token", data.token);
        localStorage.setItem("@adapti:user", JSON.stringify(data.user));

        
        // Exemplo de redirecionamento futuro:
        window.location.href = "inicio.html";
      } catch (error) {
        msgErro.innerText = error.message;
        msgErro.style.display = "block";
      }
    });
  }
});