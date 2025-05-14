# Plano de Testes e Validação: Mapeamento de Campos para Listas de Questões

Este documento detalha o plano de testes e validação para o mapeamento e integração dos campos do Sequelize para os modelos `FirebaseQuestionList` e `FirebaseQuestionListItem` no Firebase.

**Arquivos Afetados:**
-   `src/types/firebaseTypes.ts` (definições das interfaces `FirebaseQuestionList` e `FirebaseQuestionListItem` e Enum `FirebaseQuestionListStatus`)
-   `src/services/firebaseQuestionListService.ts` (lógica de CRUD e outras operações que utilizam esses campos)

## 1. Objetivos da Validação

-   Confirmar que todos os campos especificados do Sequelize foram corretamente mapeados para as interfaces Firebase.
-   Verificar se os tipos de dados no Firebase são apropriados para cada campo.
-   Garantir que os serviços (`firebaseQuestionListService.ts`) utilizem e atualizem esses campos corretamente durante as operações de criação, atualização e atividades de estudo.
-   Validar os valores padrão e a lógica de inicialização para os novos campos.

## 2. Campos Mapeados e Validação

### 2.1. Para `FirebaseQuestionList`

Campos do Sequelize a serem mapeados/validados:
-   `status` (Enum)
-   `viewCount`
-   `favoriteCount`
-   `lastStudyDate`
-   `completionPercentage`
-   `lastAddedAt`

**Análise e Validação (conforme `firebaseTypes.ts` e `firebaseQuestionListService.ts`):**

-   **`status: FirebaseQuestionListStatus;`**
    -   **Interface:** Corretamente definido usando o enum `FirebaseQuestionListStatus` (ACTIVE, ARCHIVED).
    -   **Serviço (`createQuestionList`):** Inicializado com `FirebaseQuestionListStatus.ACTIVE` por padrão.
    -   **Serviço (`updateQuestionList`):** Permite a atualização do status.
    -   **Validação:** OK.

-   **`viewCount?: number;`**
    -   **Interface:** Corretamente definido como opcional e numérico.
    -   **Serviço (`createQuestionList`):** Inicializado com `0`.
    -   **Serviço (`incrementViewCount`):** Função dedicada para incrementar o contador.
    -   **Validação:** OK.

-   **`favoriteCount?: number;`**
    -   **Interface:** Corretamente definido como opcional e numérico.
    -   **Serviço (`createQuestionList`):** Inicializado com `0`.
    -   **Serviço (`toggleFavorite`):** Função dedicada para incrementar/decrementar (embora a lógica de *quem* favoritou precise de uma coleção separada para ser completa, o contador está funcional).
    -   **Validação:** OK.

-   **`lastStudyDate?: Timestamp | null;`**
    -   **Interface:** Corretamente definido como Timestamp opcional (pode ser nulo).
    -   **Serviço (`createQuestionList`):** Inicializado como `null`.
    -   **Serviço (`recordQuestionListStudyActivity`):** Atualizado para `Timestamp.now()` quando uma atividade de estudo é registrada na lista.
    -   **Validação:** OK.

-   **`completionPercentage?: number;`**
    -   **Interface:** Corretamente definido como opcional e numérico (0-100).
    -   **Serviço (`createQuestionList`):** Inicializado com `0`.
    -   **Serviço (`recalculateCompletionPercentage`):** Função dedicada para calcular e atualizar a porcentagem com base nos `FirebaseQuestionListItem.isCompleted`.
    -   **Validação:** OK.

-   **`lastAddedAt?: Timestamp | null;`**
    -   **Interface:** Corretamente definido como Timestamp opcional (pode ser nulo).
    -   **Serviço (`createQuestionList`):** Inicializado como `null`.
    -   **Serviço (`addQuestionToList`):** Atualizado para `Timestamp.now()` quando uma questão é adicionada à lista.
    -   **Validação:** OK.

### 2.2. Para `FirebaseQuestionListItem`

Campos do Sequelize a serem mapeados/validados:
-   `isCompleted`
-   `lastAttemptDate`
-   `correctAttempts`
-   `incorrectAttempts`

**Análise e Validação (conforme `firebaseTypes.ts` e `firebaseQuestionListService.ts`):**

-   **`isCompleted: boolean;`**
    -   **Interface:** Corretamente definido como booleano.
    -   **Serviço (`addQuestionToList`):** Inicializado como `false`.
    -   **Serviço (`recordQuestionListStudyActivity`):** Atualizado para `true` se a resposta for correta (ou se já estava `true`).
    -   **Validação:** OK.

-   **`lastAttemptDate?: Timestamp | null;`**
    -   **Interface:** Corretamente definido como Timestamp opcional.
    -   **Serviço (`addQuestionToList`):** Inicializado como `null`.
    -   **Serviço (`recordQuestionListStudyActivity`):** Atualizado para `Timestamp.now()` quando uma tentativa é registrada.
    -   **Validação:** OK.

-   **`correctAttempts?: number;`**
    -   **Interface:** Corretamente definido como numérico opcional.
    -   **Serviço (`addQuestionToList`):** Inicializado como `0`.
    -   **Serviço (`recordQuestionListStudyActivity`):** Incrementado se a tentativa for correta.
    -   **Validação:** OK.

-   **`incorrectAttempts?: number;`**
    -   **Interface:** Corretamente definido como numérico opcional.
    -   **Serviço (`addQuestionToList`):** Inicializado como `0`.
    -   **Serviço (`recordQuestionListStudyActivity`):** Incrementado se a tentativa for incorreta.
    -   **Validação:** OK.

## 3. Cenários de Teste (Exemplos)

**Cenário 3.1: Criação de Nova Lista de Questões**
-   **Ação:** Chamar `firebaseQuestionListService.createQuestionList()`.
-   **Verificação:** Confirmar que a lista criada no Firestore possui `status` como ACTIVE, `viewCount`, `favoriteCount`, `completionPercentage` como 0, e `lastStudyDate`, `lastAddedAt` como null.

**Cenário 3.2: Adicionar Questão à Lista**
-   **Ação:** Chamar `firebaseQuestionListService.addQuestionToList()`.
-   **Verificação:**
    -   Confirmar que o `FirebaseQuestionListItem` criado possui `isCompleted` como false, `correctAttempts`, `incorrectAttempts` como 0, e `lastAttemptDate` como null.
    -   Confirmar que `FirebaseQuestionList.lastAddedAt` é atualizado.
    -   Confirmar que `FirebaseQuestionList.questionCount` é incrementado.

**Cenário 3.3: Registrar Atividade de Estudo (Resposta Correta)**
-   **Ação:** Chamar `firebaseQuestionListService.recordQuestionListStudyActivity()` com `isCorrect = true`.
-   **Verificação:**
    -   Confirmar que `FirebaseQuestionListItem.isCompleted` se torna true.
    -   Confirmar que `FirebaseQuestionListItem.lastAttemptDate` é atualizado.
    -   Confirmar que `FirebaseQuestionListItem.correctAttempts` é incrementado.
    -   Confirmar que `FirebaseQuestionList.lastStudyDate` é atualizado.
    -   Confirmar que `FirebaseQuestionList.completionPercentage` é recalculado corretamente.

**Cenário 3.4: Registrar Atividade de Estudo (Resposta Incorreta)**
-   **Ação:** Chamar `firebaseQuestionListService.recordQuestionListStudyActivity()` com `isCorrect = false`.
-   **Verificação:**
    -   Confirmar que `FirebaseQuestionListItem.lastAttemptDate` é atualizado.
    -   Confirmar que `FirebaseQuestionListItem.incorrectAttempts` é incrementado.
    -   Confirmar que `FirebaseQuestionList.lastStudyDate` é atualizado.
    -   Confirmar que `FirebaseQuestionList.completionPercentage` é recalculado (pode não mudar se o item já estava incompleto).

**Cenário 3.5: Incrementar Visualizações e Favoritos**
-   **Ação:** Chamar `incrementViewCount()` e `toggleFavorite()`.
-   **Verificação:** Confirmar que `FirebaseQuestionList.viewCount` e `FirebaseQuestionList.favoriteCount` são atualizados corretamente.

## 4. Conclusão Geral do Mapeamento e Integração

O mapeamento dos campos do Sequelize para `FirebaseQuestionList` e `FirebaseQuestionListItem` foi realizado com sucesso nas definições de tipo. A análise do `firebaseQuestionListService.ts` (versão recuperada) indica que os novos campos já foram integrados à lógica de criação e às funções relevantes para atualização de estatísticas e progresso.

A validação confirma que os campos são inicializados e atualizados conforme esperado, fornecendo a base para as funcionalidades de acompanhamento de progresso e estatísticas das listas de questões.

