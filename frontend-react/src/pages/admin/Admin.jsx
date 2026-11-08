import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { api } from "../../api/client.js";
import { NOMES_PERFIL, useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useTitulo } from "../../components/Layouts.jsx";
import { Esqueleto } from "../../components/Estados.jsx";
import { Barras, Paginacao, useDebounce } from "../../components/Graficos.jsx";
import { Modal, useConfirmar } from "../../components/Modal.jsx";
import { Campo, Mensagem } from "../../components/Campos.jsx";
import FormQuestao from "../../components/FormQuestao.jsx";
import { nomeArea } from "../../lib/areas.js";
import { formatarData, limparPercentual, primeiroNome, resumirTexto } from "../../lib/format.js";

export function CabecalhoPainel({ selo, classeSelo, subtitulo }) {
  const { user } = useAuth();
  return (
    <>
      <header className="saudacao">
        <span className={`selo ${classeSelo}`}>{selo}</span>
        <h1>Olá, {primeiroNome(user.name)} 👋</h1>
        <p className="subtitulo">{subtitulo}</p>
      </header>
      <Outlet />
    </>
  );
}

export function AdminLayout() {
  return <CabecalhoPainel selo="Administrador" classeSelo="selo-admin" subtitulo="Acompanhe a plataforma e gerencie usuários e questões." />;
}

// ===================== VISÃO GERAL =====================

function useVarias() {
  // As três chamadas vão para serviços diferentes; uma falhar não derruba as outras.
  const [estado, setEstado] = useState({ carregando: true });
  useEffect(() => {
    let ativo = true;
    Promise.allSettled([api("/users/stats"), api("/quests/stats"), api("/answers/admin/stats")]).then(([u, q, r]) => {
      if (ativo) setEstado({ carregando: false, u, q, r });
    });
    return () => {
      ativo = false;
    };
  }, []);
  return estado;
}

function Cartao({ titulo, resultado, carregando, children }) {
  return (
    <article className="cartao">
      <h3>{titulo}</h3>
      {carregando ? (
        <ul className="barras"><li className="vazio">Carregando…</li></ul>
      ) : resultado.status === "rejected" ? (
        <ul className="barras"><li className="vazio erro">{resultado.reason.message}</li></ul>
      ) : (
        children(resultado.value)
      )}
    </article>
  );
}

export function AdminVisao() {
  useTitulo("Administração");
  const { carregando, u, q, r } = useVarias();
  const valor = (res, fn) => (carregando ? <Esqueleto /> : res.status === "fulfilled" ? fn(res.value) : "–");

  return (
    <section className="painel-aba">
      <h2 className="titulo-aba">Visão geral</h2>
      <div className="estatisticas quatro">
        <div className="estatistica">
          <span className="estatistica-icone"><img src="/assets/pessoas.svg" alt="" /></span>
          <p className="estatistica-nome">Usuários</p>
          <p className="estatistica-valor">{valor(u, (x) => x.total)}</p>
        </div>
        <div className="estatistica">
          <span className="estatistica-icone"><img src="/assets/questoes.svg" alt="" /></span>
          <p className="estatistica-nome">Questões no banco</p>
          <p className="estatistica-valor">{valor(q, (x) => x.total)}</p>
        </div>
        <div className="estatistica">
          <span className="estatistica-icone"><img src="/assets/editar.svg" alt="" /></span>
          <p className="estatistica-nome">Respostas enviadas</p>
          <p className="estatistica-valor">{valor(r, (x) => x.summary.totalAnswers)}</p>
        </div>
        <div className="estatistica">
          <span className="estatistica-icone"><img src="/assets/alvo.svg" alt="" /></span>
          <p className="estatistica-nome">Taxa de acerto geral</p>
          <p className="estatistica-valor">{valor(r, (x) => limparPercentual(x.summary.accuracy))}</p>
        </div>
      </div>

      <div className="cartoes-grade">
        <Cartao titulo="Usuários por perfil" resultado={u} carregando={carregando}>
          {(x) => (
            <Barras
              itens={[
                { rotulo: "Alunos", valor: x.byRole.STUDENT ?? 0 },
                { rotulo: "Professores", valor: x.byRole.TEACHER ?? 0 },
                { rotulo: "Administradores", valor: x.byRole.ADMIN ?? 0 },
              ]}
            />
          )}
        </Cartao>
        <Cartao titulo="Acerto por área" resultado={r} carregando={carregando}>
          {(x) => (
            <Barras
              itens={x.byArea.map((a) => ({ chave: a.area, rotulo: nomeArea(a.area), valor: a.correct, total: a.total, texto: limparPercentual(a.accuracy) }))}
            />
          )}
        </Cartao>
        <Cartao titulo="Respostas nos últimos 7 dias" resultado={r} carregando={carregando}>
          {(x) => (
            <Barras
              itens={x.last7Days.map((d) => ({
                chave: d.date,
                rotulo: new Date(`${d.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
                valor: d.total,
              }))}
            />
          )}
        </Cartao>
        <Cartao titulo="Origem das questões" resultado={q} carregando={carregando}>
          {(x) => <Barras itens={x.bySource.map((s) => ({ chave: s.source, rotulo: s.source, valor: s.count }))} />}
        </Cartao>
      </div>
    </section>
  );
}

// ===================== USUÁRIOS =====================

function ModalUsuario({ usuario, ehVoce, aoFechar, aoSalvar }) {
  const [form, setForm] = useState({ name: usuario.name, email: usuario.email, role: usuario.role });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return setErro("Preencha nome e e-mail.");
    setSalvando(true);
    setErro("");
    try {
      const body = { name: form.name.trim(), email: form.email.trim() };
      if (!ehVoce) body.role = form.role;
      await aoSalvar(body);
    } catch (erroApi) {
      setErro(erroApi.message);
      setSalvando(false);
    }
  }

  return (
    <form className="form-painel" onSubmit={enviar}>
      <h2 className="titulo-aba">Editar usuário</h2>
      <Campo id="usuario-nome" rotulo="Nome" icone="usuario.svg" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Campo id="usuario-email" rotulo="E-mail" icone="email.svg" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <label htmlFor="usuario-perfil">Perfil</label>
      <select id="usuario-perfil" className="seletor largo" value={form.role} disabled={ehVoce} onChange={(e) => setForm({ ...form, role: e.target.value })}>
        {Object.entries(NOMES_PERFIL).map(([v, n]) => (
          <option key={v} value={v}>{n}</option>
        ))}
      </select>
      <p className="nota">{ehVoce ? "Você não pode mudar o próprio perfil." : "O usuário passa a entrar com o novo e-mail. A senha não muda."}</p>
      <Mensagem>{erro}</Mensagem>
      <div className="navegacao">
        <button type="button" className="botao-secundario" onClick={aoFechar}>Cancelar</button>
        <button type="submit" className="botao-principal" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </div>
    </form>
  );
}

export function AdminUsuarios() {
  useTitulo("Usuários");
  const { user } = useAuth();
  const avisar = useToast();
  const confirmar = useConfirmar();

  const [busca, setBusca] = useState("");
  const [perfil, setPerfil] = useState("");
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState({ carregando: true, data: [], meta: null, erro: null });
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const buscaAtrasada = useDebounce(busca);

  const carregar = useCallback(async () => {
    setLista((l) => ({ ...l, carregando: true, erro: null }));
    const params = new URLSearchParams({ page: pagina, limit: 10 });
    if (buscaAtrasada.trim()) params.set("search", buscaAtrasada.trim());
    if (perfil) params.set("role", perfil);
    try {
      const { data, meta } = await api(`/users?${params}`);
      setLista({ carregando: false, data, meta, erro: null });
    } catch (e) {
      setLista({ carregando: false, data: [], meta: null, erro: e.message });
    }
  }, [pagina, buscaAtrasada, perfil]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => setPagina(1), [buscaAtrasada, perfil]);

  async function trocarPerfil(u, novo) {
    if (!(await confirmar({ titulo: "Alterar perfil?", texto: `${u.name} passará a ser ${NOMES_PERFIL[novo]}. A mudança vale no próximo login dessa pessoa.`, confirmar: "Alterar" }))) return;
    setOcupado(u.id);
    try {
      await api(`/users/${u.id}/role`, { method: "PATCH", body: { role: novo } });
      avisar(`${u.name} agora é ${NOMES_PERFIL[novo]}.`);
      await carregar();
    } catch (e) {
      avisar(e.message, "erro");
    } finally {
      setOcupado(null);
    }
  }

  async function excluir(u) {
    if (!(await confirmar({ titulo: "Excluir usuário?", texto: `${u.name} (${u.email}) não vai mais conseguir entrar. Isso não pode ser desfeito.`, confirmar: "Excluir", perigo: true }))) return;
    setOcupado(u.id);
    try {
      await api(`/users/${u.id}`, { method: "DELETE" });
      avisar(`${u.name} foi excluído(a).`);
      if (lista.data.length === 1 && pagina > 1) setPagina(pagina - 1);
      else await carregar();
    } catch (e) {
      avisar(e.message, "erro");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="painel-aba">
      <h2 className="titulo-aba">Usuários</h2>

      <form className="ferramentas" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="campo">
          <img src="/assets/usuario.svg" alt="" />
          <label className="oculto" htmlFor="busca-usuario">Buscar por nome ou e-mail</label>
          <input id="busca-usuario" type="search" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <label className="oculto" htmlFor="filtro-perfil">Filtrar por perfil</label>
        <select id="filtro-perfil" className="seletor" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
          <option value="">Todos os perfis</option>
          <option value="STUDENT">Alunos</option>
          <option value="TEACHER">Professores</option>
          <option value="ADMIN">Administradores</option>
        </select>
      </form>

      <div className={`tabela-wrap${lista.carregando ? " atualizando" : ""}`}>
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Cadastro</th>
              <th scope="col">Perfil</th>
              <th scope="col"><span className="oculto">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.erro ? (
              <tr><td colSpan={5} className="vazio erro">{lista.erro}</td></tr>
            ) : lista.carregando && !lista.data.length ? (
              <tr><td colSpan={5} className="vazio">Carregando…</td></tr>
            ) : !lista.data.length ? (
              <tr><td colSpan={5} className="vazio">Nenhum usuário encontrado.</td></tr>
            ) : (
              lista.data.map((u) => {
                const ehVoce = u.id === user.id;
                return (
                  <tr key={u.id}>
                    <td data-rotulo="Nome"><strong>{u.name}</strong>{ehVoce && <> <span className="selo">você</span></>}</td>
                    <td data-rotulo="E-mail">{u.email}</td>
                    <td data-rotulo="Cadastro">{formatarData(u.createdAt)}</td>
                    <td data-rotulo="Perfil">
                      <label className="oculto" htmlFor={`perfil-${u.id}`}>Perfil de {u.name}</label>
                      <select className="seletor pequeno" id={`perfil-${u.id}`} value={u.role} disabled={ehVoce || ocupado === u.id} onChange={(e) => trocarPerfil(u, e.target.value)}>
                        {Object.entries(NOMES_PERFIL).map(([v, n]) => (
                          <option key={v} value={v}>{n}</option>
                        ))}
                      </select>
                    </td>
                    <td className="acoes">
                      <button type="button" className="botao-pequeno" onClick={() => setEditando(u)} disabled={ocupado === u.id}>Editar</button>
                      <button type="button" className="botao-pequeno perigo" onClick={() => excluir(u)} disabled={ehVoce || ocupado === u.id} title={ehVoce ? "Você não pode excluir a própria conta" : undefined}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Paginacao meta={lista.meta} aoMudar={setPagina} />
      <p className="nota">Ao trocar o perfil, o usuário precisa sair e entrar de novo para a mudança valer.</p>

      <Modal aberto={!!editando} aoFechar={() => setEditando(null)} titulo="Editar usuário">
        {editando && (
          <ModalUsuario
            key={editando.id}
            usuario={editando}
            ehVoce={editando.id === user.id}
            aoFechar={() => setEditando(null)}
            aoSalvar={async (body) => {
              await api(`/users/${editando.id}`, { method: "PUT", body });
              avisar(`Dados de ${body.name} atualizados.`);
              setEditando(null);
              carregar();
            }}
          />
        )}
      </Modal>
    </section>
  );
}

// ===================== QUESTÕES =====================

const ANOS_IMPORTAR = ["2023", "2022", "2021", "2020", "2019", "2018", "2017"];

export function AdminQuestoes() {
  useTitulo("Questões");
  const avisar = useToast();
  const confirmar = useConfirmar();
  const [pagina, setPagina] = useState(1);
  const [lista, setLista] = useState({ carregando: true, data: [], meta: null, erro: null });
  const [ano, setAno] = useState("2022");
  const [importando, setImportando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const carregar = useCallback(async () => {
    setLista((l) => ({ ...l, carregando: true, erro: null }));
    try {
      const { data, meta } = await api(`/quests?page=${pagina}&limit=10`);
      setLista({ carregando: false, data, meta, erro: null });
    } catch (e) {
      setLista({ carregando: false, data: [], meta: null, erro: e.message });
    }
  }, [pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function importar(e) {
    e.preventDefault();
    setImportando(true);
    try {
      const r = await api(`/quests/import/enem?year=${ano}`, { method: "POST" });
      avisar(`${r.message} (${r.count} novas)`);
      if (pagina === 1) carregar();
      else setPagina(1);
    } catch (erro) {
      avisar(erro.message, "erro");
    } finally {
      setImportando(false);
    }
  }

  async function abrirEdicao(id) {
    setOcupado(id);
    try {
      setEditando(await api(`/quests/${id}`));
    } catch (e) {
      avisar(e.message, "erro");
    } finally {
      setOcupado(null);
    }
  }

  async function excluir(q) {
    if (!(await confirmar({ titulo: "Excluir questão?", texto: "As respostas dos alunos para ela também serão apagadas.", confirmar: "Excluir", perigo: true }))) return;
    setOcupado(q.id);
    try {
      const r = await api(`/quests/${q.id}`, { method: "DELETE" });
      avisar(`Questão excluída (${r?.deletedAnswers ?? 0} resposta(s) removidas).`);
      if (lista.data.length === 1 && pagina > 1) setPagina(pagina - 1);
      else await carregar();
    } catch (e) {
      avisar(e.message, "erro");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="painel-aba">
      <h2 className="titulo-aba">Questões</h2>

      <article className="cartao destaque">
        <h3>Importar questões do ENEM</h3>
        <p className="nota">Busca até 50 questões do ano escolhido na API enem.dev.</p>
        <form className="ferramentas" onSubmit={importar}>
          <label className="oculto" htmlFor="ano-importar">Ano da prova</label>
          <select id="ano-importar" className="seletor" value={ano} onChange={(e) => setAno(e.target.value)}>
            {ANOS_IMPORTAR.map((a) => <option key={a}>{a}</option>)}
          </select>
          <button type="submit" className="botao-pequeno principal" disabled={importando}>
            {importando ? "Importando…" : "Importar"}
          </button>
        </form>
      </article>

      <div className={`tabela-wrap${lista.carregando ? " atualizando" : ""}`}>
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Enunciado</th>
              <th scope="col">Área</th>
              <th scope="col">Fonte</th>
              <th scope="col">Gabarito</th>
              <th scope="col"><span className="oculto">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.erro ? (
              <tr><td colSpan={5} className="vazio erro">{lista.erro}</td></tr>
            ) : lista.carregando && !lista.data.length ? (
              <tr><td colSpan={5} className="vazio">Carregando…</td></tr>
            ) : !lista.data.length ? (
              <tr><td colSpan={5} className="vazio">Nenhuma questão cadastrada. Importe do ENEM acima.</td></tr>
            ) : (
              lista.data.map((q) => (
                <tr key={q.id}>
                  <td data-rotulo="Enunciado" className="celula-texto">{resumirTexto(q.statement)}</td>
                  <td data-rotulo="Área">{nomeArea(q.area)}</td>
                  <td data-rotulo="Fonte">{q.source || "-"}{q.creatorId && <> <span className="selo">autoral</span></>}</td>
                  <td data-rotulo="Gabarito"><span className="letra">{q.correctOption}</span></td>
                  <td className="acoes">
                    <button type="button" className="botao-pequeno" onClick={() => abrirEdicao(q.id)} disabled={ocupado === q.id}>Editar</button>
                    <button type="button" className="botao-pequeno perigo" onClick={() => excluir(q)} disabled={ocupado === q.id}>Excluir</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Paginacao meta={lista.meta} aoMudar={setPagina} />

      <Modal aberto={!!editando} aoFechar={() => setEditando(null)} largo titulo="Editar questão">
        {editando && (
          <>
            <h2 className="titulo-aba">Editar questão</h2>
            <FormQuestao
              key={editando.id}
              questao={editando}
              textoSalvar="Salvar alterações"
              aoCancelar={() => setEditando(null)}
              aoSalvar={async (body) => {
                await api(`/quests/${editando.id}`, { method: "PUT", body });
                avisar("Questão atualizada!");
                setEditando(null);
                carregar();
              }}
            />
          </>
        )}
      </Modal>
    </section>
  );
}
