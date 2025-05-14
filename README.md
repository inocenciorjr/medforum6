# ForumMed API

API backend para a plataforma ForumMed, uma plataforma de estudos para medicina.

## Tecnologias Utilizadas

- Node.js
- Express
- TypeScript
- Firebase (Firestore, Authentication, Storage)
- Jest (testes)
- Swagger (documentação)

## Estrutura do Projeto

```
src/
├── controllers/     # Controladores da aplicação
├── middlewares/     # Middlewares do Express
├── models/          # Modelos de dados
├── routes/          # Rotas da API
├── services/        # Serviços de negócio
├── types/           # Tipos e interfaces TypeScript
├── utils/           # Utilitários
├── validators/      # Validadores de entrada
├── docs/            # Documentação
├── app.ts           # Configuração do Express
└── server.ts        # Ponto de entrada da aplicação
```

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/forummed-api.git
cd forummed-api
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## Scripts Disponíveis

- `npm run dev`: Inicia o servidor em modo de desenvolvimento
- `npm run build`: Compila o TypeScript para JavaScript
- `npm start`: Inicia o servidor em modo de produção
- `npm test`: Executa os testes
- `npm run lint`: Executa o linter
- `npm run format`: Formata o código com Prettier

## Documentação da API

A documentação da API está disponível em `/api-docs` quando o servidor está em execução. Ela é gerada automaticamente a partir do arquivo Swagger em `src/docs/swagger.yaml`.

## Principais Recursos

### Autenticação

A API utiliza autenticação baseada em JWT (JSON Web Tokens) com Firebase Authentication. Os tokens devem ser enviados no cabeçalho `Authorization` como `Bearer {token}`.

### Recursos Principais

- **Usuários**: Gerenciamento de usuários, perfis e autenticação
- **Decks e Flashcards**: Sistema de flashcards para estudo
- **Simulados**: Simulados de exames com questões de múltipla escolha
- **Questões**: Banco de questões para simulados e exercícios
- **Busca**: Busca global em múltiplas entidades
- **Admin**: Painel administrativo para gerenciamento da plataforma

## Migração para Firebase

Este projeto foi migrado do Sequelize (SQL) para Firebase (NoSQL). As principais mudanças incluem:

- Substituição de modelos Sequelize por serviços Firebase
- Adaptação das consultas para Firestore
- Implementação de novos padrões de paginação
- Otimização para o modelo de dados NoSQL

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Faça commit das suas alterações (`git commit -m 'Adiciona nova feature'`)
4. Faça push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.