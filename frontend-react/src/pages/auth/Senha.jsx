import { useState } from "react";
import { Link } from "react-router-dom";
import { LayoutAcesso, useTitulo } from "../../components/Layouts.jsx";
import { Campo, CampoSenha, Mensagem } from "../../components/Campos.jsx";

// O backend ainda não tem rotas de recuperação de senha (envio de e-mail e token).
// As telas validam os dados e explicam o que fazer, em vez de não reagirem ao clique.
const SEM_SUPORTE =
  "A recuperação de senha por e-mail ainda não está disponível. Peça a um administrador da plataforma para ajudar com o seu acesso.";

export function EsqueciSenha() {
  useTitulo("Esqueci minha senha");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  function enviar(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Informe um e-mail válido.");
    setErro("");
    setEnviado(true);
  }

  return (
    <LayoutAcesso classe="senha">
      <h1>Esqueci minha senha</h1>
      <p className="subtitulo">Informe o e-mail da sua conta para recuperar o acesso</p>

      <form onSubmit={enviar} noValidate>
        <Campo
          id="email"
          rotulo="E-mail"
          icone="email.svg"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          erro={erro}
        />
        <button type="submit" className="botao-principal">Recuperar senha</button>
        {enviado && <Mensagem tipo="info">{SEM_SUPORTE}</Mensagem>}
      </form>
      <hr />
      <p className="opcao-cadastro">
        Lembrou sua senha? <Link to="/login">Voltar para entrar</Link>
      </p>
    </LayoutAcesso>
  );
}

export function RedefinirSenha() {
  useTitulo("Redefinir senha");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  function enviar(e) {
    e.preventDefault();
    if (senha.length < 8) return setErro("A nova senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirmar) return setErro("As senhas não coincidem.");
    setErro("");
    setEnviado(true);
  }

  return (
    <LayoutAcesso classe="senha">
      <h1>Redefinir senha</h1>

      <form onSubmit={enviar} noValidate>
        <CampoSenha id="nova-senha" rotulo="Nova senha" placeholder="sua nova senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <CampoSenha id="confirmar-senha" rotulo="Confirmar senha" placeholder="repita sua nova senha" autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        <Mensagem>{erro}</Mensagem>
        <button type="submit" className="botao-principal">Redefinir senha</button>
        {enviado && <Mensagem tipo="info">{SEM_SUPORTE}</Mensagem>}
      </form>
      <hr />
      <p className="opcao-cadastro">
        <Link to="/login">Voltar para entrar</Link>
      </p>
    </LayoutAcesso>
  );
}
