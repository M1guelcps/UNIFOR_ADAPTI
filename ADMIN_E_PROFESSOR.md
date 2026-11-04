# Telas de Administrador e Professor

Este documento explica o que foi adicionado ao ADAPTI para os perfis **Administrador** e **Professor**: o que cada tela faz, quais rotas foram criadas e como o código funciona por dentro.

A arquitetura continua a mesma: frontend em HTML/CSS/JS puro, um **API Gateway** na porta 3000 e quatro microsserviços (auth, user, quest, answer). Nenhum serviço novo foi criado. Cada serviço ganhou rotas novas e manteve a divisão `routes → controllers → services → middlewares`.

---

## 1. O que cada perfil vê

| Perfil | Tela depois do login | O que pode fazer |
|---|---|---|
| Aluno (`STUDENT`) | `inicio.html` (sem mudanças) | Praticar questões e ver o próprio desempenho |
| Professor (`TEACHER`) | `professor.html` | Criar, editar e excluir **as próprias** questões e ver como os alunos foram nelas |
| Administrador (`ADMIN`) | `admin.html` | Ver números da plataforma, gerenciar usuários e gerenciar **todas** as questões. Também acessa a tela do professor |

### Tela do administrador (`frontend/HTML/admin.html`)
- **Visão geral:** total de usuários, questões, respostas e taxa de acerto geral. Também mostra gráficos de usuários por perfil, acerto por área, respostas nos últimos 7 dias e origem das questões.
- **Usuários:** busca por nome ou e-mail, filtro por perfil e paginação.
  - Troca rápida de perfil direto na tabela.
  - **Editar:** abre uma janela para mudar nome, e-mail e perfil.
  - **Excluir:** pede confirmação antes de apagar.
  - O admin não consegue excluir a si mesmo nem tirar o próprio perfil de administrador.
- **Questões:** importar até 50 questões do ENEM por ano (API enem.dev) e listar todas as questões. Cada questão tem **Editar** (abre uma janela com o formulário completo) e **Excluir**.

### Tela do professor (`frontend/HTML/professor.html`)
- **Início:** atalhos, quantidade de questões criadas, respostas recebidas, alunos alcançados, taxa de acerto e as 5 questões com menor acerto.
- **Minhas questões:** lista das questões do professor com gabarito, número de respostas, % de acerto e quantas vezes cada letra foi marcada. Botões de editar e excluir.
- **Nova questão:** formulário com enunciado, área, fonte e de 2 a 5 alternativas, com a correta marcada. O mesmo formulário é usado para editar.

A questão criada pelo professor entra no mesmo banco das questões do ENEM, então já aparece para os alunos na tela de prática.

---

## 2. Como o perfil (role) funciona

O perfil de cada usuário fica guardado no **User Service** (tabela `users`, campo `role`). O login acontece no **Auth Service**, que guarda a senha. Por isso o login passou a consultar o perfil antes de gerar o token:

```
Frontend ──POST /auth/login──▶ Gateway ──▶ Auth Service
                                             │ 1. confere e-mail e senha (bcrypt)
                                             │ 2. GET /users/internal/:id ──▶ User Service (devolve o role)
                                             │ 3. gera o JWT com { id, email, name, role }
Frontend ◀───────── { token, user: { ..., role } } ─────────┘
```

- Código: `AuthService.login` e `AuthService.fetchRole` em `backend/services/auth-service/src/services/authService.ts`.
- Se o User Service não responder, o usuário entra como `STUDENT`, o perfil com menos permissões.
- O frontend lê `user.role` e manda cada perfil para a sua tela (`frontend/JS/auth.js`).

> **Importante:** o perfil vai **dentro do token**. Se o admin mudar o perfil de alguém, a mudança só vale quando essa pessoa sair e entrar de novo.

### Proteção das rotas

O `authMiddleware` de cada serviço (quest, answer e user) valida o JWT e agora também lê o `role`. Tokens antigos, sem `role`, são tratados como `STUDENT`. Foi criado um segundo middleware, `requireRole(...)`, que libera a rota só para os perfis indicados:

```ts
// quest-service/src/routes/questRoutes.ts
router.post("/", authMiddleware, requireRole("TEACHER", "ADMIN"), QuestController.create);
```

- Sem token ou com token inválido, a resposta é **401**. Com token válido mas sem o perfil necessário, a resposta é **403**.
- O arquivo é o mesmo nos três serviços: `src/middlewares/authMiddleware.ts`.
- O user-service não tinha middleware de autenticação. Ele ganhou o mesmo arquivo, a dependência `jsonwebtoken` e a variável `JWT_SECRET` no `.env`.
- A proteção de verdade é a do backend. No frontend, `protegerPagina()` em `sessao.js` só evita abrir uma tela que daria erro.

---

## 3. Rotas novas

Todas são acessadas pelo Gateway (`http://localhost:3000`) e exigem o header `Authorization: Bearer <token>`.

### User Service

| Método | Rota | Perfil | O que faz |
|---|---|---|---|
| GET | `/users/me` | qualquer | Dados do usuário logado |
| GET | `/users?page&limit&role&search` | ADMIN | Lista paginada, com filtros |
| GET | `/users/stats` | ADMIN | Total de usuários por perfil |
| PATCH | `/users/:id/role` | ADMIN | Troca só o perfil |
| PUT | `/users/:id` | ADMIN | Edita `name`, `email` e/ou `role` |
| DELETE | `/users/:id` | ADMIN | Exclui o usuário |

### Quest Service

| Método | Rota | Perfil | O que faz |
|---|---|---|---|
| POST | `/quests` | TEACHER, ADMIN | Cria questão (o `creatorId` vem do token) |
| GET | `/quests/mine` | TEACHER, ADMIN | Questões criadas pelo usuário logado |
| GET | `/quests/:id` | TEACHER, ADMIN | Questão completa, com gabarito |
| PUT | `/quests/:id` | dono ou ADMIN | Edita só os campos enviados |
| DELETE | `/quests/:id` | dono ou ADMIN | Exclui a questão e as respostas dela |
| GET | `/quests/stats` | ADMIN | Total, autorais x importadas, por área e por fonte |
| POST | `/quests/import/enem?year=` | ADMIN | *Já existia; agora exige admin* |

Formato para criar ou editar uma questão:

```json
{
  "statement": "Em uma PA, a1 = 3 e r = 4. Qual é o 10º termo?",
  "options": ["36", "39", "40", "43", "45"],
  "correctOption": "B",
  "area": "matematica",
  "source": "Lista 1 – PA"
}
```

- `options` aceita uma lista de textos ou `[{ "letter": "A", "text": "..." }]`. As letras são reatribuídas em ordem (A, B, C…) e a questão é salva no mesmo formato das questões do ENEM.
- O controller valida: o enunciado não pode estar vazio, deve haver de 2 a 5 alternativas sem texto vazio, e `correctOption` precisa ser a letra de uma das alternativas.

### Answer Service

| Método | Rota | Perfil | O que faz |
|---|---|---|---|
| GET | `/answers/teacher/stats` | TEACHER, ADMIN | Desempenho dos alunos nas questões do professor |
| GET | `/answers/admin/stats` | ADMIN | Totais da plataforma, acerto por área, respostas nos últimos 7 dias |

O answer-service usa o mesmo banco do quest-service (`adapti_quest`). Por isso ele consegue cruzar as respostas com o `creatorId` da questão sem chamar outro serviço.

### Auth Service (rotas internas)

| Método | Rota | Quem chama |
|---|---|---|
| PATCH | `/auth/internal/users/:id` | User Service, quando o admin muda nome ou e-mail |
| DELETE | `/auth/internal/users/:id` | User Service, quando o admin exclui um usuário |

---

## 4. Comunicação entre serviços

Nome e e-mail existem em **dois bancos**: no Auth, que é usado no login, e no User, que é usado no restante do sistema. Para que não fiquem diferentes, o admin sempre fala com o User Service, e o User Service avisa o Auth. É o mesmo padrão que já existia no cadastro, só que no sentido contrário:

```
Cadastro (já existia):   Auth Service ──POST /users/internal/sync──────▶ User Service
Editar usuário (novo):   User Service ──PATCH /auth/internal/users/:id──▶ Auth Service
Excluir usuário (novo):  User Service ──DELETE /auth/internal/users/:id─▶ Auth Service
Login (novo):            Auth Service ──GET /users/internal/:id─────────▶ User Service
```

- **Editar** (`UserService.updateUser`): o Auth é atualizado primeiro. Se ele recusar, por exemplo porque o e-mail já está em uso, a resposta é **409** e nada muda no User Service.
- **Excluir** (`UserService.deleteUser`): o login é removido primeiro. Se o Auth estiver fora do ar, a resposta é **503** e o usuário continua inteiro nos dois serviços.
- O endereço do Auth vem da variável `AUTH_SERVICE_URL`, no `.env` do user-service.

### Rotas internas bloqueadas no Gateway

Rotas `internal` são só para conversa entre serviços. O Gateway (`gateway/src/server.ts`) responde **403** para `/users/internal/*` e `/auth/internal/*` antes de encaminhar a requisição. O bloqueio fica registrado antes dos proxies porque, no Express, a ordem dos `app.use` importa.

---

## 5. Frontend

| Arquivo | Papel |
|---|---|
| `frontend/JS/sessao.js` | Funções compartilhadas pelas duas telas (detalhes abaixo) |
| `frontend/JS/admin.js` | Lógica da tela do admin: abas, tabelas, janelas de edição e importação do ENEM |
| `frontend/JS/professor.js` | Lógica da tela do professor: resumo, lista, formulário de criar e editar |
| `frontend/JS/auth.js` | Passou a redirecionar conforme o perfil |
| `frontend/CSS/style.css` | Bloco novo no final ("PAINÉIS DE ADMIN E PROFESSOR") |

O que tem em `sessao.js`:
- `apiAuth()` faz o `fetch` com o token. Em caso de 401, faz logout; nos outros erros, mostra a mensagem que veio da API.
- `protegerPagina()` confere o perfil antes de mostrar a tela.
- `iniciarAbas()` cuida da navegação pelo menu, guardando a aba atual no `#` da URL.
- Também tem funções para desenhar barras e paginação e para escapar HTML.

Como as telas funcionam:
- Elas reaproveitam o menu lateral, os cartões de estatística e as cores das telas do aluno.
- No celular, o menu vai para baixo e as tabelas viram cartões.
- Cada aba busca os dados só quando é aberta.
- A visão geral do admin chama três serviços em paralelo (`Promise.allSettled`). Se um deles estiver fora do ar, as outras partes da tela continuam aparecendo.
- Todo texto que vem da API passa por `escaparHtml()` antes de ir para a tela.

---

## 6. Como rodar e testar

1. Em cada `.env` dos serviços, ajuste a senha do MySQL em `DATABASE_URL`. No `.env` do **user-service**, adicione também as duas linhas abaixo. Sem elas, as rotas de admin respondem 500.
   ```
   JWT_SECRET="sua_chave_secreta_aqui"   # o mesmo valor usado nos outros serviços
   AUTH_SERVICE_URL="http://localhost:3001"
   ```
2. Em cada pasta (gateway e os quatro serviços), rode `npm install` e depois `npx prisma generate`.
   - Nos serviços auth, user e quest, rode também `npx prisma migrate deploy`.
   - No answer-service, rode **só** o `generate`, sem `migrate`. Ele usa o banco do quest-service.
3. Rode `npm run dev` em cada uma das 5 pastas.
4. Abra `frontend/HTML/login.html` com o Live Server.

**Testes com o Postman:** a coleção `ADAPTI.postman_collection.json` é compartilhada fora do repositório. Importe no Postman e rode primeiro a pasta **"1. Auth"**. Ela cria os usuários de teste e guarda os tokens:

| E-mail | Senha | Perfil |
|---|---|---|
| admin@adapti.com | 123456 | ADMIN |
| professor@adapti.com | 123456 | TEACHER |
| aluno@adapti.com | 123456 | STUDENT |

Depois rode as outras pastas na ordem. A pasta **"6. Permissões"** mostra as rotas sendo negadas (401/403) para quem não tem o perfil certo.

---

## 7. Mudanças em comportamentos que já existiam

- `POST /quests/import/enem` era público e agora exige token de **ADMIN**.
- O login agora devolve `user.role`, e o token passou a carregar o `role`.

## 8. Limitações conhecidas

- **Cadastro aceita `role`:** o `POST /auth/register` aceita o campo `role` vindo do cliente, então qualquer pessoa consegue se cadastrar como ADMIN. Isso facilita os testes, mas precisa ser fechado antes de publicar. Uma solução é sempre criar como STUDENT e deixar o admin promover.
- **Gabarito exposto ao aluno:** o `GET /quests`, usado pela tela do aluno, devolve o `correctOption`. Isso já era assim antes destas mudanças.
- **Perfil só muda no próximo login:** a troca de perfil só vale quando o usuário entra de novo, porque o perfil fica dentro do token.
- **Respostas sem dono:** ao excluir um usuário, as respostas dele continuam no banco de questões, sem dono. Elas ainda contam nas estatísticas.
- **Alternativas com imagem:** algumas questões do ENEM têm alternativas que são só imagem. Ao editar uma dessas pelo formulário, as imagens se perdem, porque o formulário guarda só texto.
- **`node_modules` no git:** os `node_modules` estão versionados e foram instalados no Windows. No Mac ou no Linux é preciso rodar `npm install` e `npx prisma generate`. O recomendado é adicionar `node_modules/` ao `.gitignore`.
