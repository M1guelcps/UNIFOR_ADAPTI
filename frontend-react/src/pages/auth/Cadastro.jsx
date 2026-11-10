import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { LayoutAcesso, useTitulo } from "../../components/Layouts.jsx";
import { Campo, CampoSenha, Mensagem } from "../../components/Campos.jsx";

const SENHA_MINIMA = 6;

function forcaDaSenha(senha) {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;
  return [
    { rotulo: "Fraca", classe: "fraca" },
    { rotulo: "Fraca", classe: "fraca" },
    { rotulo: "Média", classe: "media" },
    { rotulo: "Boa", classe: "boa" },
    { rotulo: "Forte", classe: "forte" },
  ][pontos];
}

export default function Cadastro() {
  useTitulo("Cadastro");
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", email: "", senha: "", confirmar: "" });
  const [tocados, setTocados] = useState({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const atualizar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const tocar = (campo) => () => setTocados((t) => ({ ...t, [campo]: true }));

  const erros = {
    nome: form.nome.trim().split(/\s+/).length < 2 ? "Informe nome e sobrenome." : "",
    email: /^\S+@\S+\.\S+$/.test(form.email.trim()) ? "" : "Informe um e-mail válido.",
    senha: form.senha.length < SENHA_MINIMA ? `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` : "",
    confirmar: form.confirmar !== form.senha ? "As senhas não coincidem." : "",
  };
  const forca = form.senha ? forcaDaSenha(form.senha) : null;

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    setTocados({ nome: true, email: true, senha: true, confirmar: true });
    if (Object.values(erros).some(Boolean)) return;

    setEnviando(true);
    try {
      // Cadastro público sempre cria aluno. Professores e administradores
      // são promovidos depois, pelo painel do administrador.
      await api("/auth/register", {
        method: "POST",
        auth: false,
        body: { name: form.nome.trim(), email: form.email.trim(), password: form.senha, role: "STUDENT" },
      });
      navigate("/login", { replace: true, state: { cadastrado: true, email: form.email.trim() } });
    } catch (erroApi) {
      setErro(erroApi.message);
      setEnviando(false);
    }
  }

  return (
    <LayoutAcesso classe="cadastro">
      <h1>Cadastro</h1>
      <p className="subtitulo">Crie sua conta para começar</p>

      <Mensagem>{erro}</Mensagem>

      <form onSubmit={enviar} noValidate>
        <Campo
          id="nome"
          rotulo="Nome"
          icone="usuario.svg"
          placeholder="seu nome completo"
          autoComplete="name"
          value={form.nome}
          onChange={atualizar("nome")}
          onBlur={tocar("nome")}
          erro={tocados.nome && erros.nome}
        />
        <Campo
          id="email"
          rotulo="E-mail"
          icone="email.svg"
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          value={form.email}
          onChange={atualizar("email")}
          onBlur={tocar("email")}
          erro={tocados.email && erros.email}
        />
        <CampoSenha
          id="senha"
          rotulo="Senha"
          placeholder="sua senha"
          autoComplete="new-password"
          value={form.senha}
          onChange={atualizar("senha")}
          onBlur={tocar("senha")}
          erro={tocados.senha && erros.senha}
        />
        {forca && (
          <p className={`forca-senha ${forca.classe}`}>
            <span className="forca-barra" aria-hidden="true"><span /></span>
            Senha {forca.rotulo.toLowerCase()}
          </p>
        )}
        <CampoSenha
          id="confirmar-senha"
          rotulo="Confirmar senha"
          placeholder="confirme sua senha"
          autoComplete="new-password"
          value={form.confirmar}
          onChange={atualizar("confirmar")}
          onBlur={tocar("confirmar")}
          erro={tocados.confirmar && erros.confirmar}
        />

        <button type="submit" className="botao-principal" disabled={enviando}>
          {enviando ? "Criando conta…" : "Criar conta"}
        </button>
      </form>
      <hr />
      <p className="opcao-cadastro">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </LayoutAcesso>
  );
}
