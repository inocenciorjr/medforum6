# Arquitetura do Sistema

Este documento descreve a arquitetura do sistema ForumMed API, incluindo componentes, fluxos de dados, decisões técnicas e padrões de design.

## Visão Geral

A ForumMed API é uma aplicação backend construída com Node.js, Express e TypeScript, utilizando o Firebase como plataforma de banco de dados e autenticação. A arquitetura segue o padrão MVC (Model-View-Controller) adaptado para APIs, com foco em escalabilidade, manutenibilidade e desempenho.

## Diagrama de Componentes

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cliente   │────▶│    Rotas    │────▶│ Middlewares │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Firebase  │◀───▶│  Serviços   │◀────│Controladores│
└─────────────┘     └─────────────┘     └─────────────┘
                                               ▲
                                               │
                                        ┌─────────────┐
                                        │ Validadores │
                                        └─────────────┘
```

## Camadas da Aplicação

### 1. Rotas (Routes)

As rotas definem os endpoints da API e direcionam as requisições para os controladores apropriados. Elas são organizadas por domínio (usuários, decks, questões, etc.) e seguem uma estrutura RESTful.

**Localização**: `src/routes/`

### 2. Middlewares

Os middlewares processam as requisições antes que elas cheguem aos controladores. Eles são responsáveis por:

- Autenticação e autorização
- Validação de entrada
- Logging
- Tratamento de erros
- Rate limiting

**Localização**: `src/middlewares/`

### 3. Controladores (Controllers)

Os controladores recebem as requisições das rotas, processam os dados de entrada, chamam os serviços necessários e retornam as respostas. Eles são responsáveis pela lógica de apresentação e não devem conter lógica de negócio complexa.

**Localização**: `src/controllers/`

### 4. Serviços (Services)

Os serviços contêm a lógica de negócio da aplicação. Eles são responsáveis por:

- Interagir com o Firebase (Firestore, Auth, Storage)
- Implementar regras de negócio
- Processar dados
- Gerenciar transações

**Localização**: `src/services/`

### 5. Validadores (Validators)

Os validadores garantem que os dados de entrada estejam corretos antes de serem processados pelos controladores. Eles utilizam o express-validator para definir regras de validação.

**Localização**: `src/validators/`

### 6. Utilitários (Utils)

Os utilitários contêm funções auxiliares que são utilizadas em várias partes da aplicação, como:

- Manipulação de datas
- Formatação de dados
- Funções de segurança
- Helpers para Firebase
- Paginação

**Localização**: `src/utils/`

## Modelo de Dados

A aplicação utiliza o Firestore, um banco de dados NoSQL orientado a documentos. As principais coleções são:

- **users**: Informações dos usuários
- **decks**: Decks de flashcards
- **flashcards**: Cartões de estudo
- **questions**: Questões para simulados
- **simulatedExams**: Simulados de exames
- **articles**: Artigos e conteúdos
- **payments**: Informações de pagamento
- **reports**: Denúncias de conteúdo
- **activityLogs**: Logs de atividade dos usuários
- **systemLogs**: Logs do sistema

## Fluxo de Autenticação

1. O usuário se autentica usando Firebase Authentication
2. O cliente recebe um token JWT
3. O cliente envia o token no cabeçalho `Authorization` das requisições
4. O middleware de autenticação verifica o token com o Firebase
5. Se válido, o usuário é identificado e a requisição prossegue
6. Se inválido, a requisição é rejeitada com erro 401

## Estratégias de Cache

A aplicação implementa várias estratégias de cache para melhorar o desempenho:

1. **Cache em memória**: Para dados frequentemente acessados e que mudam pouco
2. **Cache no Firestore**: Para dados compartilhados entre instâncias
3. **Cache de consultas**: Para resultados de consultas complexas

## Escalabilidade

A arquitetura foi projetada para escalar horizontalmente:

1. **Stateless**: A aplicação não mantém estado entre requisições
2. **Modular**: Componentes podem ser escalados independentemente
3. **Assíncrono**: Operações de I/O são assíncronas para maximizar throughput
4. **Eficiente**: Consultas são otimizadas para minimizar leitura/escrita

## Segurança

A aplicação implementa várias camadas de segurança:

1. **Autenticação**: Firebase Authentication com JWT
2. **Autorização**: Controle de acesso baseado em papéis (RBAC)
3. **Validação**: Validação rigorosa de entrada
4. **Sanitização**: Sanitização de dados para prevenir injeção
5. **Rate Limiting**: Limitação de taxa para prevenir abusos
6. **Logs**: Registro de atividades para auditoria

## Decisões Técnicas

### Migração de SQL para NoSQL

A migração do Sequelize (SQL) para Firebase (NoSQL) foi motivada por:

1. **Escalabilidade**: Melhor suporte para escala horizontal
2. **Flexibilidade**: Esquema flexível para evolução rápida
3. **Integração**: Ecossistema Firebase para autenticação, storage, etc.
4. **Operacional**: Redução de custos operacionais e manutenção

### TypeScript

O uso de TypeScript proporciona:

1. **Segurança de tipos**: Detecção de erros em tempo de compilação
2. **Documentação**: Interfaces e tipos servem como documentação
3. **Refatoração**: Facilita refatorações seguras
4. **Produtividade**: Melhor suporte de IDE e autocompletion

### Arquitetura em Camadas

A separação em camadas (rotas, controladores, serviços) proporciona:

1. **Testabilidade**: Facilita testes unitários e de integração
2. **Manutenibilidade**: Código mais organizado e modular
3. **Separação de responsabilidades**: Cada componente tem um propósito claro
4. **Reutilização**: Serviços podem ser reutilizados por diferentes controladores

## Monitoramento e Observabilidade

A aplicação implementa:

1. **Logging**: Logs estruturados para depuração e auditoria
2. **Métricas**: Coleta de métricas de desempenho
3. **Rastreamento**: Rastreamento de requisições para identificar gargalos
4. **Alertas**: Notificações para eventos críticos

## Considerações Futuras

1. **GraphQL**: Avaliar migração para GraphQL para consultas mais flexíveis
2. **Microsserviços**: Considerar decomposição em microsserviços para escala maior
3. **Serverless**: Explorar funções serverless para componentes específicos
4. **Caching distribuído**: Implementar Redis para cache distribuído
5. **CDN**: Utilizar CDN para conteúdo estático e caching de API