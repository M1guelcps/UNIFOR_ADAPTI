## PLANEJAMENTO DA ENTREGA



adapti/
├── frontend/
│   ├── index.html
│   ├── cadastro.html
│   ├── style.css
│   ├── js/
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── questoes.js
│   └── assets/
│
├── gateway/
│   └── src/
│       ├── server.ts
│       └── routes/
│
├── services/
│   ├── auth-service/
│   │   ├── prisma/
│   │   └── src/
│   │       ├── server.ts
│   │       ├── routes/
│   │       ├── controllers/
│   │       ├── services/
│   │       └── middlewares/
│   │
│   ├── user-service/
│   │   ├── prisma/
│   │   └── src/
│   │
│   ├── quest-service/
│   │   ├── prisma/
│   │   └── src/
│   │
│   └── answer-service/
│       ├── prisma/
│       └── src/
│
├── .gitignore
├── README.md
└── package.json




Etapa 1 — Organizar o repositório e o ambiente
Primeiro passo
- Separar frontend, Gateway e serviços backend.
- Padronizar os arquivos .env.
- Confirmar as versões do Node.js, TypeScript e Prisma.
- Definir as portas e os comandos para iniciar cada aplicação.
Conclusão: todos os componentes iniciam localmente e a estrutura está clara.




Etapa 2 — Preparar os bancos e os modelos
- Configurar o MySQL para autenticação.
- Criar o modelo de credenciais do usuário.
- Modelar disciplinas, temas, questões, alternativas e respostas.
- Executar as migrações e testar a conexão.
Conclusão: os dados podem ser persistidos e consultados corretamente.




Etapa 3 — Implementar o Auth Service
- Cadastro com nome, e-mail e senha.
- Hash seguro da senha, usando bcrypt ou Argon2.
- Login com validação das credenciais.
- Emissão e validação de JWT.
- Respostas HTTP consistentes para erros e sucessos.
Conclusão: cadastro e login funcionam por uma ferramenta de testes de API.




Etapa 4 — Implementar o Quest Service
- Listar disciplinas e temas.
- Listar questões por tema.
- Retornar as alternativas sem revelar qual é a correta.
- Manter a resposta correta somente no backend.
Conclusão: o frontend consegue exibir um questionário real.




Etapa 5 — Implementar o Answer Service
- Receber o ID da questão e da alternativa selecionada.
- Identificar o usuário autenticado pelo token validado.
- Verificar se a alternativa pertence à questão.
- Corrigir a resposta no backend e armazenar o resultado.
- Consultar o histórico do próprio usuário.
Conclusão: uma resposta é registrada e corrigida de ponta a ponta.




Etapa 6 — Construir o API Gateway
- Centralizar as rotas públicas e protegidas.
- Encaminhar as chamadas aos serviços.
- Tratar serviços indisponíveis.
- Evitar expor desnecessariamente as portas internas ao frontend.
Conclusão: o frontend acessa o sistema por um único endereço.




Etapa 7 — Integrar o frontend
- Fazer o cadastro enviar dados à API.
- Fazer o login receber e utilizar o token.
- Criar a tela de disciplinas, questões e alternativas.
- Exibir o resultado e o histórico.
- Tratar carregamento, erros e campos obrigatórios.
Conclusão: o usuário consegue utilizar o sistema pela interface já criada.




Etapa 8 — Testar, documentar e apresentar
- Testar o fluxo completo.
- Documentar os endpoints com Swagger/OpenAPI.
- Preparar dados de demonstração.
- Explicar responsabilidades, comunicação e persistência de cada serviço.
- Só então preparar a hospedagem.