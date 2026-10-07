# XTPG - Job `classificacao_fluxo_caixa_xtpg`

Este documento detalha a logica do job `classificacao_fluxo_caixa_xtpg` sem exigir leitura do codigo. Ele explica quando o job roda, quais linhas ele busca, quais cadastros consulta, como decide o item de fluxo de caixa e como registra sucesso ou erro.

## Objetivo

O job classifica registros contabeis para o XTPG preenchendo o campo:

- `registros_contabeis.item_fluxo_de_caixa`

No Prisma/codigo, esse campo aparece como:

- `AccountingDocumentItem.ItemFluxodeCaixa`

Esse item e necessario para que as views de envio XTPG consigam selecionar registros elegiveis para:

- `XRT_SendPrevPagto`
- `XRT_SendFlux`

Em termos simples:

```text
registros_contabeis sem item de fluxo valido
   |
   v
classificacao_fluxo_caixa_xtpg
   |
   v
registros_contabeis com ItemFluxodeCaixa preenchido
   |
   v
views XTPG passam a poder enviar previsto/realizado
```

## Onde Fica

Job:

- `src/cron/jobs/classificacaoFluxoCaixaXtpgJob.ts`

Service principal:

- `src/cron/modules/fluxo-caixa-xtpg/services/DeduzirItemFluxoCaixaXtpgService.ts`

Utils usados:

- `src/cron/modules/fluxo-caixa-xtpg/utils/itemFluxoCaixaXtpgNormalize.ts`
- `src/cron/modules/fluxo-caixa-xtpg/utils/buildXtpgTipoLancamentoKeyFromRegistro.ts`
- `src/modules/fluxo-caixa-xtpg/utils/xtpgKeyNormalize.ts`

Endpoint manual:

- `POST /fluxo-caixa-xtpg/classificar-lote`

## Configuracao

Variaveis:

- `CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG`
- `CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG_ENABLED`
- `CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE`

Defaults no codigo:

- schedule: `0 */6 * * *`
- enabled: somente quando `CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG_ENABLED=true`
- batch size: `500`

O job tambem permite disparo manual pela tela de integracoes porque tem:

- `manualTrigger: true`
- key: `classificacao_fluxo_caixa_xtpg`

## Formas de Execucao

### Via cron

O `CronManager` executa o job conforme o schedule configurado. A task cria uma instancia de `DeduzirItemFluxoCaixaXtpgService` e chama:

```text
service.execute()
```

Nesse modo, o limite vem de:

- `CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE`

### Via integracoes

Endpoint generico:

- `POST /integracoes/classificacao_fluxo_caixa_xtpg/run`

Esse caminho dispara a task do job.

### Via endpoint do modulo

Endpoint especifico:

- `POST /fluxo-caixa-xtpg/classificar-lote`

Body opcional:

```json
{
  "limit": 500
}
```

Regras do `limit` nesse endpoint:

- inteiro positivo;
- maximo `5000`;
- se nao informado, usa `CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE`.

Resposta:

```json
{
  "message": "Classificacao XTPG executada",
  "processed": 0,
  "classified": 0,
  "errorsSet": 0,
  "skippedAlreadyValid": 0
}
```

## Resumo da Ordem de Execucao

```text
1. Definir limite do lote
2. Reabrir erros quando o cadastro da conta foi atualizado
3. Buscar candidatos em registros_contabeis
4. Ignorar candidatos que ja possuem item de fluxo valido
5. Buscar todas as linhas dos documentos dos candidatos
6. Montar lookup de contas contabeis elegiveis
7. Buscar referencias de reversao e clearing
8. Buscar regras de tipo de lancamento
9. Buscar vinculos por parceiro
10. Classificar cada linha, respeitando a prioridade das regras
11. Atualizar sucessos em transacao
12. Atualizar erros em transacao
13. Registrar resumo no log e retornar contadores
```

## Entrada do Job

A entrada real e a tabela:

- `registros_contabeis`

Modelo Prisma:

- `AccountingDocumentItem`

Campos lidos para decidir candidatos:

- `ItemFluxodeCaixa`
- `XtpgClassificacaoErro`
- `PostingDate`
- `CompanyCode`

Campos lidos para classificacao:

- `CompanyCode`
- `FiscalYear`
- `AccountingDocument`
- `AccountingDocumentItem`
- `ChartOfAccounts`
- `GLAccount`
- `AmountInBalanceTransacCrcy`
- `PostingKey`
- `AccountingDocumentType`
- `ReferenceDocumentType`
- `IsReversed`
- `ReversalReason`
- `DebitCreditCode`
- `Supplier`
- `Customer`
- `ReverseDocument`
- `ReverseDocumentFiscalYear`
- `IsCleared`
- `ClearingDocFiscalYear`
- `ClearingAccountingDocument`
- `ClearingItem`

## Saida do Job

### Quando classifica com sucesso

Atualiza a linha em `registros_contabeis`:

- `item_fluxo_de_caixa = <item resolvido>`
- `xtpg_classificacao_erro = null`
- `xtpg_classificacao_erro_em = null`

### Quando nao consegue classificar

Atualiza a linha em `registros_contabeis`:

- `xtpg_classificacao_erro = <mensagem de erro>`
- `xtpg_classificacao_erro_em = <data/hora atual>`

O texto do erro e truncado em 500 caracteres.

### Contadores retornados

O service retorna:

- `processed`: quantidade de candidatos buscados no lote.
- `classified`: quantidade de linhas classificadas com sucesso.
- `errorsSet`: quantidade de linhas marcadas com erro.
- `skippedAlreadyValid`: quantidade de candidatos ignorados porque ja estavam com item valido.

## Criterio de Candidato

O job busca linhas com:

```text
XtpgClassificacaoErro = null
AND
(
  ItemFluxodeCaixa is null
  OR ItemFluxodeCaixa esta na lista de reservados
)
```

Itens reservados:

- string vazia;
- `0`;
- `999`.

Esses valores nao representam classificacao valida para envio ao XTPG. A normalizacao usada e simples:

- `null` vira string vazia;
- valores texto passam por `trim`;
- `0` e string vazia em referencias de documento tambem sao tratados como ausencia.

Ordenacao da busca:

```text
1. PostingDate desc
2. CompanyCode asc
```

Limite:

- valor recebido em `execute({ limit })`; ou
- `CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE`.

## Reabertura de Linhas com Erro

Antes de buscar candidatos, o job executa uma reabertura de erros antigos.

Uma linha com erro so volta para a fila quando o cadastro da conta contabil foi alterado depois do erro:

```text
registros_contabeis.xtpg_classificacao_erro_em is not null
AND existe conta em contas_contabeis com:
  company_code = rc.company_code
  gl_account = rc.gl_account
  data_alteracao > rc.xtpg_classificacao_erro_em
```

Quando essa condicao e verdadeira, o job limpa:

- `xtpg_classificacao_erro`
- `xtpg_classificacao_erro_em`

Por que isso existe:

- a maior parte dos erros de classificacao depende de cadastro;
- reprocessar a mesma linha sem alteracao de cadastro tende a repetir o mesmo erro;
- evita que o cron fique processando indefinidamente as mesmas falhas.

## Dados Carregados Antes de Classificar

Depois de buscar os candidatos, o service prepara dados auxiliares em lote para evitar consultas linha a linha sempre que possivel.

### Linhas irmas do mesmo documento

Para cada candidato, monta a chave de documento:

```text
CompanyCode | FiscalYear | AccountingDocument
```

Depois busca todas as linhas desses documentos em `registros_contabeis`.

Uso:

- deducao por contrapartida;
- lookup de contas das linhas do documento.

### Lookup de contas contabeis

O job monta dois mapas de `contas_contabeis`, sempre filtrando:

```text
XtpgAtivado = true
```

Mapa principal:

```text
ChartOfAccounts | CompanyCode | GLAccount
```

Mapa fallback:

```text
CompanyCode | GLAccount
```

Ordem de procura:

```text
1. Se a linha tem ChartOfAccounts, tenta ChartOfAccounts + CompanyCode + GLAccount
2. Se nao encontrar, tenta CompanyCode + GLAccount
```

Uso:

- validar se a conta da linha e elegivel;
- obter item default da conta;
- classificar por contrapartida;
- resolver se a linha pode ou nao ser classificada pelo XTPG.

### Referencias de reversao

Para linhas com:

- `ReverseDocument`
- `ReverseDocumentFiscalYear`

O job tenta localizar o documento original usando:

```text
CompanyCode
ReverseDocumentFiscalYear
ReverseDocument
AccountingDocumentItem
```

Uso:

- copiar o `ItemFluxodeCaixa` do documento original quando ele ja esta classificado.

### Referencias de clearing

Para linhas com:

- `IsCleared = X`
- `ClearingDocFiscalYear`
- `ClearingAccountingDocument`
- `ClearingItem`

O job tenta localizar a linha compensada usando:

```text
CompanyCode
ClearingDocFiscalYear
ClearingAccountingDocument
ClearingItem
```

Uso:

- copiar o `ItemFluxodeCaixa` do documento compensado quando ele ja esta classificado.

### Regras por tipo de lancamento

O job monta uma chave normalizada a partir da linha contabil:

```text
companyCode
postingKey
documentType
referenceDocumentType
isReversed
reversalReason
debitCreditCode
```

Normalizacoes:

- `companyCode`: `trim`.
- `postingKey`: `trim` e maximo 2 caracteres.
- `documentType`: `trim` e maximo 2 caracteres.
- `referenceDocumentType`: `trim` e maximo 10 caracteres.
- `isReversed`: somente `X` permanece `X`; qualquer outro valor vira string vazia.
- `reversalReason`: `trim` e maximo 2 caracteres.
- `debitCreditCode`: `trim`, uppercase, maximo 1 caractere.

A chave so e valida quando:

- `postingKey` existe;
- `documentType` existe;
- `debitCreditCode` e `S` ou `H`.

Com essa chave, busca em:

- `fluxo_caixa_cia_tipo_lancamento`

Uso:

- deducao por parametrizacao de tipo de lancamento.

### Vinculos por parceiro

O job coleta fornecedores/clientes dos candidatos:

```text
Supplier OU Customer
```

Depois busca em:

- `fluxo_caixa_cia_parceiro`

Mapa montado:

```text
cardCode | companyCode -> itemFluxoCaixa
```

Uso:

- fallback por parceiro quando regras anteriores nao resolveram.

## Regra de Classificacao por Linha

Para cada linha candidata, a decisao acontece nesta ordem:

```text
1. Verificar elegibilidade da conta contabil
2. Usar item default da propria conta
3. Copiar item do documento original em reversao
4. Copiar item do documento compensado em clearing
5. Deduzir por contrapartida
6. Deduzir por tipo de lancamento
7. Deduzir por parceiro
8. Marcar erro se nenhuma regra resolver
```

A primeira regra que retorna um item valido encerra a classificacao daquela linha.

## Prioridade 1 - Elegibilidade da Conta

Antes de qualquer tentativa de deducao, o job procura a conta da linha em `contas_contabeis`.

Se nao encontrar conta elegivel, ou se a conta nao tiver:

```text
XtpgAtivado = true
```

A linha recebe erro:

```text
Conta contábil não elegível para classificação XTPG (plano inexistente ou XTPG não ativo).
```

Consequencia:

- nenhuma outra regra e tentada para essa linha.

## Prioridade 2 - Item Default da Conta

Se a conta esta ativa para XTPG, o job tenta usar:

- `contas_contabeis.ItemFluxoDeCaixa`

O valor passa pela normalizacao e precisa ser valido.

Invalidos:

- vazio;
- `0`;
- `999`.

Se for valido, a linha e classificada imediatamente com esse item.

## Prioridade 3 - Documento Original em Reversao

Se a linha tem referencia de reversao:

- `ReverseDocument`
- `ReverseDocumentFiscalYear`

O job procura a linha original usando o mesmo `AccountingDocumentItem`.

Se encontrar a original e ela possuir `ItemFluxodeCaixa` valido, copia esse item para a linha atual.

Se a referencia estiver ausente, zerada, nao encontrada ou com item invalido, a regra nao resolve e o job segue para a proxima prioridade.

## Prioridade 4 - Documento Compensado em Clearing

Se a linha esta marcada como compensada:

- `IsCleared = X`

E possui dados de clearing:

- `ClearingDocFiscalYear`
- `ClearingAccountingDocument`
- `ClearingItem`

O job procura a linha compensada.

Se encontrar a linha compensada e ela possuir `ItemFluxodeCaixa` valido, copia esse item para a linha atual.

Se nao encontrar ou o item nao for valido, segue para a proxima prioridade.

## Prioridade 5 - Contrapartida no Mesmo Documento

O job usa as linhas irmas do mesmo documento contabil.

Passos:

```text
1. Obter o sinal do valor da linha atual
2. Ignorar linhas com valor zero
3. Procurar linhas do mesmo documento com sinal oposto
4. Ordenar as contrapartidas por maior valor absoluto
5. Para cada contrapartida, procurar conta contabil elegivel
6. Se a conta da contrapartida tiver ItemFluxoDeCaixa valido, usar esse item
```

Observacoes:

- a propria linha candidata e ignorada;
- valores com mesmo sinal nao entram como contrapartida;
- a primeira contrapartida elegivel com item valido vence;
- se nenhuma contrapartida resolver, segue para tipo de lancamento.

## Prioridade 6 - Tipo de Lancamento por CIA

O job monta a chave normalizada do registro e busca em:

- `fluxo_caixa_cia_tipo_lancamento`

Campos da regra:

- empresa;
- chave de lancamento;
- tipo de documento;
- tipo de documento de referencia;
- indicador de reversao;
- motivo de reversao;
- debito/credito.

Se existir regra cadastrada com `itemFluxoCaixa` valido, usa esse item.

Se a linha nao tiver dados suficientes para montar chave valida, ou nao existir cadastro, segue para parceiro.

## Prioridade 7 - Parceiro

O job identifica o parceiro pela primeira opcao preenchida:

```text
Supplier OU Customer
```

Depois tenta encontrar item nesta ordem:

```text
1. cardCode + companyCode exato
2. cardCode + companyCode vazio
```

O segundo caso funciona como fallback global do parceiro.

Se encontrar `itemFluxoCaixa` valido, usa esse item.

Se nao encontrar, marca erro generico.

## Prioridade 8 - Erro Generico

Quando nenhuma regra consegue classificar, a linha recebe:

```text
Não foi possível classificar item de fluxo de caixa (XTPG) com as regras vigentes.
```

Esse erro indica que a conta era elegivel, mas faltou regra/cadastro com item valido.

## Fluxo Visual de Decisao

```text
Linha candidata
   |
   v
Conta existe em contas_contabeis com XtpgAtivado=true?
   | nao
   v
Erro: conta inelegivel

   | sim
   v
Conta tem ItemFluxoDeCaixa valido?
   | sim -> classifica
   | nao
   v
Tem reversao com original classificado?
   | sim -> copia item do original
   | nao
   v
Tem clearing com documento compensado classificado?
   | sim -> copia item do compensado
   | nao
   v
Contrapartida do mesmo documento tem item valido?
   | sim -> usa item da contrapartida
   | nao
   v
Existe regra em fluxo_caixa_cia_tipo_lancamento?
   | sim -> usa item da regra
   | nao
   v
Existe vinculo em fluxo_caixa_cia_parceiro?
   | sim -> usa item do parceiro
   | nao
   v
Erro generico de classificacao
```

## Transacoes de Atualizacao

O service separa o resultado em duas listas:

- `updatesSuccess`
- `updatesError`

Depois executa:

- uma transacao para todos os sucessos;
- uma transacao para todos os erros.

Sucesso:

```text
ItemFluxodeCaixa = item resolvido
XtpgClassificacaoErro = null
XtpgClassificacaoErroEm = null
```

Erro:

```text
XtpgClassificacaoErro = erro truncado em 500 caracteres
XtpgClassificacaoErroEm = data/hora atual
```

O campo `ItemFluxodeCaixa` nao e sobrescrito no bloco de erro.

## Relacao com as Views de Envio

O job nao envia nada ao XTPG. Ele apenas prepara os registros para que outros fluxos consigam enviar.

Depois da classificacao:

- a view `XRT_SendPrevPagto` pode passar a enxergar registros previstos;
- a view `XRT_SendFlux` pode passar a enxergar registros realizados;
- os jobs `xtpg_enviar_previsto` e `xtpg_enviar_realizado` cuidam do SOAP e do write-back de envio.

O classificador tambem evita itens reservados porque esses valores nao existem como itens validos de fluxo no XTPG e fariam o envio falhar.

## Principais Motivos de Erro

### Conta contabil nao elegivel

Causa:

- conta nao existe em `contas_contabeis`; ou
- empresa/plano/conta nao casam; ou
- `XtpgAtivado` nao esta `true`.

Efeito:

- erro especifico de conta inelegivel;
- nenhuma regra posterior e tentada.

Como corrigir:

- cadastrar ou corrigir a conta em `contas_contabeis`;
- marcar `XtpgAtivado = true`;
- revisar `ChartOfAccounts`, `CompanyCode` e `GLAccount`.

### Conta elegivel, mas sem item resolvivel

Causa:

- `ItemFluxoDeCaixa` da conta esta vazio, `0` ou `999`;
- reversao/clearing nao apontam para documento classificado;
- contrapartida nao tem item valido;
- nao existe regra de tipo de lancamento;
- nao existe vinculo por parceiro.

Efeito:

- erro generico de classificacao.

Como corrigir:

- preencher item default na conta; ou
- cadastrar regra em `fluxo_caixa_cia_tipo_lancamento`; ou
- cadastrar vinculo em `fluxo_caixa_cia_parceiro`; ou
- corrigir documento/conta de referencia quando o problema for reversao/clearing.

### Linha ja falhou antes e nao reaparece

Causa:

- `XtpgClassificacaoErro` esta preenchido.

Efeito:

- a linha fica fora dos candidatos.

Como corrigir:

- corrigir cadastro da conta para atualizar `DataAlteracao`; ou
- limpar erro manualmente apenas quando houver motivo operacional claro.

## Como Investigar uma Linha

Use esta ordem:

```text
1. Localizar a linha em registros_contabeis pela PK
2. Verificar ItemFluxodeCaixa
3. Verificar XtpgClassificacaoErro e XtpgClassificacaoErroEm
4. Verificar CompanyCode, ChartOfAccounts e GLAccount
5. Procurar conta em contas_contabeis
6. Confirmar XtpgAtivado=true
7. Verificar ItemFluxoDeCaixa default da conta
8. Se houver reversao, verificar ReverseDocument e ReverseDocumentFiscalYear
9. Se houver clearing, verificar IsCleared e campos Clearing*
10. Verificar linhas irmas do mesmo documento para contrapartida
11. Montar chave de tipo de lancamento e procurar cadastro
12. Verificar Supplier/Customer e vinculo por parceiro
13. Ajustar cadastro e rodar novamente
```

## Como Saber Qual Regra Classificou

O service nao grava explicitamente a regra vencedora. Para inferir:

```text
1. Compare ItemFluxodeCaixa final com ItemFluxoDeCaixa da conta
2. Se igual e valido, provavelmente veio da conta
3. Se houver ReverseDocument, compare com o documento original
4. Se houver clearing, compare com o documento compensado
5. Compare com itens das contas de contrapartida
6. Compare com fluxo_caixa_cia_tipo_lancamento
7. Compare com fluxo_caixa_cia_parceiro
```

Como a prioridade e fixa, a primeira fonte que bater com item valido e a origem mais provavel.

## Cuidados Operacionais

- Nao limpe `XtpgClassificacaoErro` em massa sem corrigir cadastro; o job pode voltar a marcar o mesmo erro.
- Nao use `0`, `999` ou vazio como item definitivo; o classificador trata como invalido.
- Alterar `contas_contabeis` pode reabrir linhas com erro no proximo ciclo.
- Uma conta sem `XtpgAtivado=true` bloqueia qualquer outra tentativa de deducao.
- Regra por parceiro e fallback; se a conta tiver item default valido, o parceiro nao sera consultado.
- Regra por tipo de lancamento so roda depois de conta, reversao, clearing e contrapartida.
- O job nao marca `StatusParaEnvio` e nao grava `IdXRT`; isso e responsabilidade dos jobs de envio.

## Checklist de Validacao

Depois de ajustar cadastro ou regra:

```text
1. Rodar POST /fluxo-caixa-xtpg/classificar-lote com limit pequeno
2. Conferir processed, classified, errorsSet e skippedAlreadyValid
3. Verificar se XtpgClassificacaoErro foi limpo nas linhas corrigidas
4. Verificar se ItemFluxodeCaixa foi preenchido com item valido
5. Confirmar se a view XRT_SendPrevPagto ou XRT_SendFlux passa a retornar a linha
6. Rodar envio XTPG somente depois de validar o item resolvido
```

## Arquivos de Teste Relacionados

Testes unitarios principais:

- `tests/unit/fluxo-caixa-xtpg/DeduzirItemFluxoCaixaXtpgService.unit.test.ts`
- `tests/unit/fluxo-caixa-xtpg/buildXtpgTipoLancamentoKeyFromRegistro.unit.test.ts`
- `tests/unit/fluxo-caixa-xtpg/itemFluxoCaixaXtpgNormalize.unit.test.ts`

Cenarios cobertos nos testes:

- reabertura de linhas com erro quando cadastro muda;
- retorno zerado quando nao ha candidatos;
- classificacao pelo item default da conta;
- copia de item em reversao;
- classificacao por tipo de lancamento;
- erro quando a conta nao e elegivel.
