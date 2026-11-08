import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { LayoutApp } from "./components/Layouts.jsx";
import { RedirecionarPorPerfil, RotaProtegida, SomenteVisitante } from "./components/RotaProtegida.jsx";
import {
  IconeAdmin,
  IconeDesempenho,
  IconeInicio,
  IconeNova,
  IconePraticar,
  IconeProfessor,
  IconeUsuarios,
} from "./components/Icones.jsx";

import Login from "./pages/auth/Login.jsx";
import Cadastro from "./pages/auth/Cadastro.jsx";
import { EsqueciSenha, RedefinirSenha } from "./pages/auth/Senha.jsx";
import Inicio from "./pages/aluno/Inicio.jsx";
import ConfigurarPratica from "./pages/aluno/ConfigurarPratica.jsx";
import Pratica from "./pages/aluno/Pratica.jsx";
import Desempenho from "./pages/aluno/Desempenho.jsx";
import { AdminLayout, AdminQuestoes, AdminUsuarios, AdminVisao } from "./pages/admin/Admin.jsx";
import {
  ProfessorEditar,
  ProfessorInicio,
  ProfessorLayout,
  ProfessorNova,
  ProfessorQuestoes,
} from "./pages/professor/Professor.jsx";

const MENU_ALUNO = [
  { to: "/inicio", rotulo: "Início", Icone: IconeInicio },
  { to: "/praticar", rotulo: "Praticar", Icone: IconePraticar },
  { to: "/desempenho", rotulo: "Desempenho", Icone: IconeDesempenho },
];

const MENU_ADMIN = [
  { to: "/admin", rotulo: "Visão geral", Icone: IconeDesempenho, end: true },
  { to: "/admin/usuarios", rotulo: "Usuários", Icone: IconeUsuarios },
  { to: "/admin/questoes", rotulo: "Questões", Icone: IconePraticar },
  { to: "/professor", rotulo: "Área do professor", Icone: IconeProfessor },
];

const MENU_PROFESSOR = [
  { to: "/professor", rotulo: "Início", Icone: IconeInicio, end: true },
  { to: "/professor/questoes", rotulo: "Minhas questões", Icone: IconePraticar },
  { to: "/professor/nova", rotulo: "Nova questão", Icone: IconeNova },
];

function MenuProfessor() {
  const { user } = useAuth();
  const itens = user?.role === "ADMIN" ? [...MENU_PROFESSOR, { to: "/admin", rotulo: "Administração", Icone: IconeAdmin }] : MENU_PROFESSOR;
  return <LayoutApp itens={itens} rotuloMenu="Menu do professor" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirecionarPorPerfil />} />

      {/* Acesso */}
      <Route path="/login" element={<SomenteVisitante><Login /></SomenteVisitante>} />
      <Route path="/cadastro" element={<SomenteVisitante><Cadastro /></SomenteVisitante>} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />

      {/* Aluno */}
      <Route element={<RotaProtegida perfis={["STUDENT"]}><LayoutApp itens={MENU_ALUNO} /></RotaProtegida>}>
        <Route path="/inicio" element={<Inicio />} />
        <Route path="/praticar" element={<ConfigurarPratica />} />
        <Route path="/praticar/sessao" element={<Pratica />} />
        <Route path="/desempenho" element={<Desempenho />} />
      </Route>

      {/* Administrador */}
      <Route element={<RotaProtegida perfis={["ADMIN"]}><LayoutApp itens={MENU_ADMIN} rotuloMenu="Menu do administrador" /></RotaProtegida>}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminVisao />} />
          <Route path="usuarios" element={<AdminUsuarios />} />
          <Route path="questoes" element={<AdminQuestoes />} />
        </Route>
      </Route>

      {/* Professor (o admin também acessa) */}
      <Route element={<RotaProtegida perfis={["TEACHER", "ADMIN"]}><MenuProfessor /></RotaProtegida>}>
        <Route path="/professor" element={<ProfessorLayout />}>
          <Route index element={<ProfessorInicio />} />
          <Route path="questoes" element={<ProfessorQuestoes />} />
          <Route path="nova" element={<ProfessorNova />} />
          <Route path="editar/:id" element={<ProfessorEditar />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
