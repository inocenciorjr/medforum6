# Guia de Contribuição

Obrigado pelo interesse em contribuir com o projeto ForumMed API! Este documento fornece diretrizes e instruções para contribuir com o projeto.

## Código de Conduta

Este projeto adota um Código de Conduta que esperamos que todos os participantes sigam. Por favor, leia o [Código de Conduta](CODE_OF_CONDUCT.md) antes de contribuir.

## Como Contribuir

### Reportando Bugs

Se você encontrou um bug, por favor, crie uma issue seguindo estas etapas:

1. Verifique se o bug já não foi reportado
2. Use o template de bug report
3. Inclua passos detalhados para reproduzir o problema
4. Descreva o comportamento esperado e o comportamento atual
5. Inclua screenshots se possível
6. Mencione a versão do Node.js e outras informações relevantes

### Sugerindo Melhorias

Se você tem uma ideia para melhorar o projeto:

1. Verifique se a melhoria já não foi sugerida
2. Use o template de feature request
3. Descreva detalhadamente a melhoria
4. Explique por que essa melhoria seria útil
5. Considere como ela poderia ser implementada

### Pull Requests

1. Faça um fork do repositório
2. Clone seu fork: `git clone https://github.com/seu-usuario/forummed-api.git`
3. Crie uma branch para sua feature: `git checkout -b feature/nome-da-feature`
4. Faça suas alterações
5. Execute os testes: `npm test`
6. Faça commit das alterações: `git commit -m 'feat: adiciona nova funcionalidade'`
7. Faça push para a branch: `git push origin feature/nome-da-feature`
8. Abra um Pull Request

## Fluxo de Trabalho com Git

### Branches

- `main`: Branch principal, sempre estável
- `develop`: Branch de desenvolvimento
- `feature/*`: Branches para novas funcionalidades
- `bugfix/*`: Branches para correção de bugs
- `hotfix/*`: Branches para correções urgentes em produção
- `release/*`: Branches para preparação de releases

### Commits

Utilizamos o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>[escopo opcional]: <descrição>

[corpo opcional]

[rodapé(s) opcional(is)]
```

Tipos comuns:
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Alterações na documentação
- `style`: Alterações que não afetam o código (formatação, etc.)
- `refactor`: Refatoração de código
- `test`: Adição ou correção de testes
- `chore`: Alterações no processo de build, ferramentas, etc.

Exemplo:
```
feat(auth): adiciona autenticação com Google

Implementa autenticação com Google OAuth2 usando Firebase Auth.

Closes #123
```

## Padrões de Código

### Estilo de Código

- Utilizamos ESLint e Prettier para garantir a consistência do código
- Execute `npm run lint` antes de fazer commit
- Execute `npm run format` para formatar o código automaticamente

### TypeScript

- Utilize tipos explícitos sempre que possível
- Evite o uso de `any`
- Documente interfaces e tipos complexos

### Testes

- Escreva testes para todas as novas funcionalidades
- Mantenha a cobertura de testes acima de 80%
- Testes devem ser independentes e não depender de estado externo

## Processo de Revisão

1. Pelo menos um mantenedor deve aprovar o Pull Request
2. Todos os testes automatizados devem passar
3. O código deve seguir os padrões do projeto
4. A documentação deve ser atualizada, se necessário

## Estrutura do Projeto

Ao adicionar novos arquivos, siga a estrutura existente:

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

## Documentação

- Atualize a documentação Swagger ao adicionar ou modificar endpoints
- Documente funções e classes com JSDoc
- Mantenha o README atualizado

## Considerações de Segurança

- Nunca comite credenciais ou segredos
- Valide todas as entradas do usuário
- Siga as melhores práticas de segurança OWASP
- Reporte vulnerabilidades de segurança diretamente aos mantenedores

## Dúvidas?

Se você tiver dúvidas sobre como contribuir, entre em contato com os mantenedores ou abra uma issue com sua pergunta.