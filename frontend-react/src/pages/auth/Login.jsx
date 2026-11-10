import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { DESTINO_POR_PERFIL, useAuth } from "../../context/AuthContext.jsx";
import { LayoutAcesso, useTitulo } from "../../components/Layouts.jsx";
import { Campo, CampoSenha, Mensagem } from "../../components/Campos.jsx";

export default function Login() {
  useTitulo("Entrar");
  const { entrar, expirou, limparExpirou } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email ?? "");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    limparExpirou();
    setEnviando(true);
    try {
      const user = await entrar(email.trim(), senha);
      const destino = DESTINO_POR_PERFIL[user.role] || "/inicio";
      // Volta para a página que a pessoa tentou abrir, se for do mesmo perfil
      const de = location.state?.de;
      navigate(de && de.startsWith(destino) ? de : destino, { replace: true });
    } catch (erroApi) {
      setErro(erroApi.message);
      setEnviando(false);
    }
  }

  return (
    <LayoutAcesso classe="login">
      <h1>Entrar</h1>
      <p className="subtitulo">Continue aprendendo no seu ritmo</p>

      {location.state?.cadastrado && !erro && (
        <Mensagem tipo="sucesso">Conta criada! Agora é só entrar.</Mensagem>
      )}
      {expirou && !erro && <Mensagem tipo="erro">Sua sessão expirou. Entre novamente.</Mensagem>}
      <Mensagem>{erro}</Mensagem>

      <form onSubmit={enviar}>
        <Campo
          id="email"
          rotulo="E-mail"
          icone="email.svg"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CampoSenha
          id="senha"
          rotulo="Senha"
          placeholder="sua senha"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <Link className="recuperar" to="/esqueci-senha">Esqueci minha senha</Link>
        <button type="submit" className="botao-principal" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <hr />
      <p className="opcao-cadastro">
        Não tem conta? <Link to="/cadastro">Cadastre-se</Link>
      </p>
    </LayoutAcesso>
  );
}
