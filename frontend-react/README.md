# ADAPTI: frontend em React

Nova versão do frontend, feita com **React 18 + Vite + React Router**. Ela fica ao lado da pasta `frontend/` (HTML puro), que continua funcionando enquanto a migração não termina.

O visual é o mesmo: o `style.css` original foi copiado sem mudanças para `src/styles/style.css`, e os assets estão em `public/assets/`. Os estilos novos ficam separados em `src/styles/extras.css`.

## Como rodar

```bash
cd frontend-react
npm install
npm run dev        # abre http://localhost:5173
```

Antes, suba o Gateway (porta 3000) e os quatro serviços normalmente. Para usar outro endereço de Gateway, copie `.env.example` para `.env` e altere `VITE_API_URL`.

Para gerar a versão de produção, rode `npm run build`. O resultado vai para `dist/`.

## Rotas

| Rota | Perfil | Tela |
|---|---|---|
| `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha` | público | Acesso |
| `/inicio` | aluno | Início |
| `/praticar` | aluno | Configurar prática |
| `/praticar/sessao` | aluno | Resolver questões / simulado |
| `/desempenho` | aluno | Desempenho |
| `/admin`, `/admin/usuarios`, `/admin/questoes` | admin | Painel do administrador |
| `/professor`, `/professor/questoes`, `/professor/nova`, `/professor/editar/:id` | professor e admin | Área do professor |

A sessão usa as mesmas chaves do frontend antigo (`@adapti:token` e `@adapti:user`). O token expirado é detectado sozinho, e qualquer resposta 401 manda a pessoa de volta para o login.

## Estrutura

```
src/
  api/client.js          fetch único para o Gateway (token, erros, 401)
  context/               sessão (AuthContext) e avisos flutuantes (ToastContext)
  components/            layouts, menu, modal/confirmação, gráficos, formulário de questão,
                         TextoRico (renderiza o enunciado com segurança)
  lib/                   áreas, formatação, histórico de práticas, hook de carregamento
  pages/auth|aluno|admin|professor
```

## O que mudou em relação à versão HTML

**Correções na prática**
- O enunciado era inserido com `innerHTML` (risco de XSS). Agora é renderizado como texto, e só imagens `https://` em markdown e **negrito**/*itálico* são interpretados. As imagens do ENEM passaram a aparecer.
- A alternativa correta nunca ficava destacada, porque o front lia `result.correctAnswer` e a API devolve `correctOption`, e só quando a resposta está errada. Isso foi corrigido.
- Os filtros de área e ano não tinham efeito, porque o `GET /quests` não filtra. Agora o front busca as questões e filtra por área (normalizando "ciencias-humanas", "Matemática" e variações) e por ano (lido da fonte "ENEM 2023").
- Foi adicionada a opção **Todas** as áreas.
- O **modo Simulado** funciona: não mostra a correção na hora, tem um mapa das questões e um botão "Entregar". Só depois da entrega as respostas vão para o backend e o gabarito aparece.
- O tempo é registrado. Ao final aparecem o resultado e a **revisão** de cada questão.

**Telas com dados reais**
- Início: o número de simulados é o real, e "Último resultado" mostra a última prática feita, em vez do texto fixo "36 de 45".
- Desempenho: tempo praticando, últimas práticas, respostas recentes e mensagens para quando ainda não há dados.

**Cadastro e senha**
- O cadastro público **sempre cria aluno**. O campo de perfil foi removido, porque antes qualquer pessoa conseguia se cadastrar como ADMIN pela tela.
- O cadastro valida os campos na hora e mostra a força da senha.
- Esqueci/Redefinir senha agora validam os dados e explicam que a recuperação ainda não existe no backend. Antes os botões não faziam nada, e o redefinir tinha os caminhos de CSS e imagens quebrados.

**Experiência de uso**
- Avisos flutuantes e janelas de confirmação substituem os `alert()` e `confirm()`.
- Todas as telas têm estados de carregando, erro (com "Tentar de novo") e vazio.
- Atalhos na prática: `1`–`5` ou `A`–`E` escolhem a alternativa, `Enter` responde ou avança e `←`/`→` navegam.
- A busca de usuários do admin é feita enquanto você digita.
- O formulário de questão tem prévia do enunciado.
- O navegador avisa antes de fechar a aba no meio de uma prática.

## Limitações (dependem do backend)

- **Filtro de questões:** o filtro é feito no navegador, sobre um lote de até 1000 questões. Quando o `GET /quests` aceitar `?area=&year=`, basta trocar a função `buscarQuestoes` em `src/pages/aluno/Pratica.jsx`.
- **Histórico de práticas e simulados:** o backend não tem o conceito de simulado nem guarda o tempo gasto. Por isso esse resumo fica no `localStorage`, separado por usuário, e não aparece em outro navegador ou dispositivo. As respostas em si continuam sendo salvas no backend.
- **Recuperação de senha:** não existe rota para isso no backend.
- **Cadastro com `role`:** o `POST /auth/register` ainda aceita `role` vindo do cliente. O front sempre manda `STUDENT`, mas alguém pode chamar a API direto. O ideal é o backend ignorar esse campo.
