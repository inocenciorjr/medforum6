# Plano de Testes e Validação: Exclusão de Deck com Flashcards

Este documento detalha o plano de testes e validação para a funcionalidade de exclusão de um deck, que, conforme definido, também resultará na exclusão permanente de todos os flashcards e suas interações associadas a esse deck.

**Serviço Afetado:** `firebaseDeckService.ts` (método `deleteDeck`)
**Serviços Relacionados:** `firebaseFlashcardService.ts` (indiretamente, pela exclusão de flashcards e interações)

## 1. Objetivos da Validação

-   Verificar se a exclusão de um deck resulta na exclusão de todos os seus flashcards associados.
-   Verificar se a exclusão dos flashcards também resulta na exclusão de todas as `UserFlashcardInteraction` associadas a esses flashcards.
-   Garantir que a operação seja atômica (ou o mais próximo possível com as operações em lote do Firestore), ou seja, se a exclusão do deck falhar, os flashcards não devem ser excluídos indevidamente, e vice-versa.
-   Confirmar que apenas o proprietário do deck pode excluí-lo.
-   Testar o comportamento com decks vazios (sem flashcards).
-   Testar o comportamento com decks contendo um pequeno número de flashcards.
-   Testar o comportamento com decks contendo um número de flashcards que exceda o limite de uma única consulta `in` (mais de 30, para testar a lógica de chunking na exclusão de interações).
-   Verificar o tratamento de erros (ex: deck não encontrado, usuário não autorizado).

## 2. Cenários de Teste

**Pré-condições para todos os testes:**
-   Um usuário de teste autenticado.
-   Dados de teste: decks, flashcards e interações de flashcards criados para este usuário.

**Cenário 2.1: Exclusão de Deck Vazio**
-   **Descrição:** Tentar excluir um deck que não contém flashcards.
-   **Passos:**
    1.  Criar um deck para o usuário de teste.
    2.  Chamar `FirebaseDeckService.deleteDeck(deckId, userId)`.
-   **Resultado Esperado:**
    -   O deck é excluído com sucesso da coleção `decks`.
    -   Nenhuma operação de exclusão de flashcards ou interações é tentada (ou falha graciosamente se tentada em um conjunto vazio).

**Cenário 2.2: Exclusão de Deck com Poucos Flashcards (e Interações)**
-   **Descrição:** Tentar excluir um deck que contém < 30 flashcards, cada um com algumas interações.
-   **Passos:**
    1.  Criar um deck para o usuário de teste.
    2.  Criar 5 flashcards associados a este deck.
    3.  Registrar 2-3 interações para cada um desses flashcards.
    4.  Chamar `FirebaseDeckService.deleteDeck(deckId, userId)`.
-   **Resultado Esperado:**
    -   O deck é excluído com sucesso da coleção `decks`.
    -   Todos os 5 flashcards associados são excluídos da coleção `flashcards`.
    -   Todas as interações associadas aos flashcards excluídos são removidas da coleção `userFlashcardInteractions`.
    -   A operação em lote é concluída com sucesso.

**Cenário 2.3: Exclusão de Deck com Muitos Flashcards (>30, para testar chunking de interações)**
-   **Descrição:** Tentar excluir um deck que contém > 30 flashcards para testar a lógica de exclusão de interações em lotes.
-   **Passos:**
    1.  Criar um deck para o usuário de teste.
    2.  Criar 35 flashcards associados a este deck.
    3.  Registrar 1-2 interações para cada um desses flashcards.
    4.  Chamar `FirebaseDeckService.deleteDeck(deckId, userId)`.
-   **Resultado Esperado:**
    -   O deck é excluído com sucesso da coleção `decks`.
    -   Todos os 35 flashcards associados são excluídos da coleção `flashcards`.
    -   Todas as interações associadas aos flashcards excluídos são removidas da coleção `userFlashcardInteractions` (verificar se a lógica de chunking para a query `in` funcionou).
    -   A operação em lote é concluída com sucesso.

**Cenário 2.4: Tentativa de Exclusão de Deck por Usuário Não Autorizado**
-   **Descrição:** Um usuário tenta excluir um deck que não lhe pertence.
-   **Passos:**
    1.  Criar um deck com `user1`.
    2.  Tentar excluir este deck usando as credenciais de `user2` (`FirebaseDeckService.deleteDeck(deckId, user2Id)`).
-   **Resultado Esperado:**
    -   A operação falha.
    -   Um erro `AppError.forbidden` é lançado.
    -   O deck e seus flashcards (se houver) permanecem intactos.

**Cenário 2.5: Tentativa de Exclusão de Deck Inexistente**
-   **Descrição:** Tentar excluir um deck com um ID que não existe.
-   **Passos:**
    1.  Chamar `FirebaseDeckService.deleteDeck("nonExistentDeckId", userId)`.
-   **Resultado Esperado:**
    -   A operação falha.
    -   Um erro `AppError.notFound` é lançado.

**Cenário 2.6: Falha Parcial na Operação em Lote (Simulação, se possível)**
-   **Descrição:** (Difícil de simular diretamente sem acesso a mocks profundos do Firestore) Avaliar a robustez da transação em lote. Se uma parte do lote falhar (ex: exclusão de um flashcard), o que acontece com o restante?
-   **Análise Teórica:** O Firestore Batch Write garante que todas as operações no lote tenham sucesso ou todas falhem. Se houver um erro em qualquer operação do lote (ex: permissão, documento não existe no momento da exclusão), o lote inteiro é revertido.
-   **Resultado Esperado (Teórico):** Se qualquer exclusão dentro do lote falhar, o lote inteiro deve falhar, e o deck, os flashcards e as interações devem permanecer no estado anterior à tentativa de exclusão.

## 3. Metodologia de Teste

-   **Testes Manuais:** Executar os cenários acima interagindo diretamente com o serviço (por exemplo, através de um script de teste ou uma interface de API temporária, se disponível) e verificando os dados no console do Firebase Firestore.
-   **Revisão de Código:** Revisar cuidadosamente a lógica implementada no método `deleteDeck` em `firebaseDeckService.ts`, especialmente o manuseio de lotes e a consulta para flashcards e interações.
-   **Testes Unitários/Integração (Recomendado para o futuro):** Idealmente, testes unitários para a lógica de consulta e testes de integração usando o emulador do Firestore para simular os cenários de forma automatizada.

## 4. Critérios de Aceitação

-   Todos os cenários de teste descritos passam conforme os resultados esperados.
-   O código está claro, bem documentado e segue as melhores práticas.
-   A exclusão de dados é realizada de forma segura e eficiente.
-   O usuário é devidamente autorizado antes da exclusão.

## 5. Considerações Adicionais

-   **Performance:** Para decks com um número extremamente grande de flashcards (milhares), a busca e a adição ao lote podem levar tempo. Embora o Firestore Batch Write suporte até 500 operações, a coleta dos documentos a serem excluídos é a etapa anterior. A abordagem atual de buscar todos os flashcards e depois todas as interações (em chunks) é razoável para a maioria dos casos de uso, mas deve ser monitorada em produção se surgirem decks muito grandes.
-   **Interface do Usuário:** A interface do usuário deve claramente alertar sobre a natureza permanente da exclusão do deck e de seus flashcards associados, possivelmente exigindo uma confirmação explícita.

