# Frontend em React e nova interface

Este documento explica o que entrou na branch `feature/frontend-react`: o frontend novo em React, as correções que vieram junto e o que ainda depende do backend.

**Resumo:** o frontend foi recriado em React, numa pasta nova (`frontend-react/`). A pasta `frontend/`, em HTML, **não foi alterada** e continua funcionando. O backend teve **uma única mudança**: uma linha no auth-service.

---

## 1. Como rodar

O jeito mais rápido é usar o script `iniciar.ps1`, na raiz do projeto. Ele abre cada serviço, o gateway e o frontend numa janela separada e roda `npm install` onde ainda não houver `node_modules`:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

Para rodar só o frontend, com o backend já ligado:

```powershell
cd frontend-react
npm install
npm run dev      # abre em http://localhost:5173
```

> **PowerShell:** o PowerShell do Windows não aceita `&&`. Use `;` para encadear comandos, ou abra um terminal por serviço.

O frontend chama o Gateway em `http://localhost:3000`. Para usar outro endereço, copie `frontend-react/.env.example` para `.env` e altere `VITE_API_URL`.

### Contas para testar

O cadastro pela tela sempre cria aluno. Para ter os três perfis no seu banco, crie as contas pela API, porque ela ainda aceita o campo `role`. Use, por exemplo, a pasta "1. Auth" da coleção do Postman:

| Perfil | E-mail | Senha |
|---|---|---|
| Aluno | `aluno@adapti.com` | `123456` |
| Professor | `professor@adapti.com` | `123456` |
| Admin | `admin@adapti.com` | `123456` |

Se o banco estiver sem questões, entre como admin e use **Questões → Importar**.

---

## 2. Por que uma pasta nova

A migração foi feita ao lado da versão HTML, e não no lugar dela, para não atrapalhar quem está mexendo em `frontend/`. Quando a versão React estiver aprovada, dá para apagar a pasta antiga.

- **Mesma sessão:** o front novo usa as mesmas chaves do antigo (`@adapti:token` e `@adapti:user`). Quem está logado num continua logado no outro.
- **Mesmas rotas da API:** nenhuma rota nova foi criada e nenhum contrato da API mudou.

### Estrutura

```
frontend-react/src/
  api/client.js        fetch único para o Gateway (token, erros, 401 → login)
  context/             sessão (AuthContext) e avisos flutuantes (ToastContext)
  components/          layout e menu, modal de confirmação, gráficos, formulário de questão,
                       TextoRico (mostra o enunciado com segurança)
  lib/                 áreas, formatação, busca de questões, histórico de práticas
  pages/
    auth/              login, cadastro, esqueci/redefinir senha
    aluno/             início, configurar prática, prática, desempenho
    admin/             visão geral, usuários, questões
    professor/         início, minhas questões, nova/editar questão
  styles/app.css       todo o visual (as cores e medidas ficam no topo, em :root)
```

### Rotas

| Rota | Perfil |
|---|---|
| `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha` | público |
| `/inicio`, `/praticar`, `/praticar/sessao`, `/desempenho` | aluno |
| `/admin`, `/admin/usuarios`, `/admin/questoes` | admin |
| `/professor`, `/professor/questoes`, `/professor/nova`, `/professor/editar/:id` | professor e admin |

Cada perfil cai na sua tela depois do login, como já acontecia no front HTML.

---

## 3. Bugs encontrados e corrigidos

Estes problemas existiam no front HTML. Alguns só aparecem quando se lê o backend junto.

| Problema | Causa | Como ficou |
|---|---|---|
| A alternativa correta nunca ficava verde | O front lia `result.correctAnswer`, mas a API devolve `correctOption`, e só quando a resposta está errada | O front usa `correctOption`. Quando a resposta está certa, a alternativa correta é a marcada |
| Os filtros de área e ano não faziam efeito | `GET /quests` ignora `?area=` e `?year=` | O front filtra (ver seção 5) |
| Risco de XSS no enunciado | O enunciado entrava via `innerHTML` sem escapar | Agora é renderizado como texto. Só imagens `https://` em markdown e negrito/itálico são interpretados. As imagens do ENEM passaram a aparecer |
| Enunciado com `\[...\]` | O ENEM manda escapes de markdown | Os escapes são removidos na exibição |
| Qualquer um virava ADMIN pela tela de cadastro | O campo de perfil estava no formulário público | A tela sempre envia `STUDENT`. Admin e professor são promovidos em **Usuários** |
| O modo Simulado era ignorado | Não havia lógica para ele | Funciona (ver seção 4) |
| "Último resultado" fixo em "36 de 45" e simulados sempre 0 | Era texto fixo no HTML | Usam dados reais |
| Os botões de Esqueci/Redefinir senha não faziam nada, e o redefinir tinha os caminhos quebrados | Não existe rota no backend | Os campos são validados e a tela explica que a recuperação ainda não existe |

---

## 4. O que mudou para quem usa

**Aluno**
- **Configurar prática:**
  - Cada área e cada ano mostram quantas questões existem.
  - Opções sem questões ficam desativadas.
  - Um resumo ao lado mostra a prática escolhida, e o botão de começar fica bloqueado quando não há questões.
- **Modo Questões:** a correção aparece logo depois de cada resposta.
- **Modo Simulado:**
  - Nada é corrigido durante a prova.
  - Um mapa mostra as questões e as que já foram marcadas.
  - O botão "Entregar" avisa quantas questões ficaram em branco.
  - Só na entrega as respostas vão para o backend.
- **Ao final de cada prática:**
  - Aparecem o placar, o tempo e uma revisão de cada questão.
  - O navegador avisa antes de fechar a aba no meio da prática.
- **Atalhos de teclado:** `1`–`5` ou `A`–`E` escolhem a alternativa, `Enter` responde ou avança e `←`/`→` navegam.
- **Desempenho:**
  - acerto por área, melhor área e área para revisar;
  - tempo total praticando e últimas práticas;
  - respostas recentes.

**Professor**
- O formulário de questão tem **prévia** do enunciado.
- A edição abre numa rota própria (`/professor/editar/:id`).

**Admin**
- A busca de usuários acontece enquanto se digita.
- Trocar o perfil e excluir pedem confirmação na própria tela, sem o `confirm()` do navegador.
- Se um serviço cair, o resto da visão geral continua aparecendo.

**Geral**
- **Visual novo:** fonte Inter, cartões, menu lateral com o nome e o perfil do usuário e uma barra inferior no celular. O login tem duas colunas.
- **Avisos e estados:** avisos flutuantes no lugar de `alert()`, e todas as telas têm estados de carregando, erro (com "Tentar de novo") e vazio.
- **Sessão expirada:** o token expirado é detectado sozinho, e qualquer 401 manda de volta para o login.

---

## 5. O que ainda depende do backend

Estes pontos foram contornados no front, mas o certo é resolver no backend:

1. **Filtro de questões:** o `GET /quests` não filtra por área nem por ano. Por isso o front busca até 1000 questões de uma vez e filtra no navegador. Quando a rota aceitar `?area=&year=`, basta trocar a função em `frontend-react/src/lib/questoes.js`.
2. **A importação do ENEM só traz Linguagens e Humanas:** `importEnemQuestions` busca sempre as **50 primeiras** questões da prova (`?limit=50`, sem `offset`), e no ENEM elas são de Linguagens e Humanas. Por isso Matemática e Natureza ficam vazias. Seria preciso paginar a importação.
3. **Simulado e tempo:** o backend não tem o conceito de simulado e não guarda o tempo gasto. O resumo de cada prática fica no `localStorage`, separado por usuário, e não aparece em outro navegador. As respostas em si continuam indo para o backend normalmente.
4. **`POST /auth/register` aceita `role`:** a tela não manda mais, mas qualquer pessoa ainda pode chamar a API direto e se cadastrar como ADMIN. O backend deveria ignorar esse campo e sempre criar `STUDENT`.
5. **Gabarito exposto:** o `GET /quests` devolve `correctOption`, e as alternativas importadas do ENEM vêm com `isCorrect`. O front novo não usa esses campos, mas eles aparecem na aba Network do navegador.
6. **Recuperação de senha:** não existe rota para isso.

---

## 6. A única mudança no backend

O arquivo é `backend/services/auth-service/src/lib/prisma.ts`, e a mudança é uma linha:

```ts
allowPublicKeyRetrieval: true
```

- **O problema:** o auth-service usa o conector `@prisma/adapter-mariadb`, diferente dos outros três serviços. No MySQL 8, que usa `caching_sha2_password`, esse conector falha com `ER_CANNOT_RETRIEVE_RSA_KEY` sempre que o servidor acabou de reiniciar. O login ficava 10 segundos travado e depois dava erro de pool.
- **Por que só no auth:** os outros serviços usam o Prisma padrão e não têm o problema.
- **Atenção:** essa opção é para desenvolvimento local. Num servidor real, a conexão com o banco deve usar SSL.

> **`.env` não foi commitado:** os `.env` continuam como estavam no repositório. Se o seu MySQL roda em outra porta (por exemplo, 3307 no Docker), ajuste o `DATABASE_URL` só na sua máquina.

---

## 7. Como foi testado

- **Testes de fluxo:** 59 cenários rodando num navegador simulado, com uma API falsa no mesmo formato da real. Eles cobrem login, cadastro, prática, simulado, admin e professor.
- **Telas reais:** as telas foram abertas no Chrome contra o backend real, no computador e no celular, sem erros no console.
- **Build:** `npm run build` sem erros.

Não há testes automatizados no repositório. Os de fluxo foram rodados fora dele, só para validar esta entrega.
