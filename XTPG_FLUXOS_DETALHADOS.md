# XTPG - Fluxos Detalhados

Este documento explica o modulo XTPG no backend, com foco na ordem de execucao, nos pontos de decisao e nos cuidados de idempotencia. Ele deve servir como guia para manutencao, troubleshooting e onboarding de devs novos.

## Resumo Executivo

No contexto deste projeto, XTPG e a integracao com a plataforma DeepXRT usada por tesouraria/fluxo de caixa.

O backend atua em dois sentidos:

- Entrada para o XTPG: le dados vindos do SAP/S4 e tabelas internas, classifica item de fluxo de caixa e envia movimentos de previsto/realizado ao DeepXRT.
- Saida do XTPG: le movimentos contabeis disponibilizados pelo DeepXRT, monta LCM/Journal Entry e integra no SAP/S4.

Os tres blocos principais sao:

- Classificacao de fluxo de caixa: preenche `ItemFluxodeCaixa` em `registros_contabeis`.
- XTPG Entrada/Envio: envia `SendPrev` e `SendFlux` para o SOAP `Entrada.asmx`.
- XTPG Saida/Retorno: consome `Saida.asmx`, cria LCM no S/4 e devolve status ao XTPG.

## Ordem Geral de Execucao

Esta e a ordem logica do fluxo completo. Os crons podem ter agendas independentes, mas a dependencia funcional e esta:

```text
1. SAP/S4 ou stage alimenta registros_contabeis
   |
   v
2. Cadastros de apoio precisam estar completos
   - contas_contabeis
   - fluxo_caixa_cia_parceiro
   - fluxo_caixa_cia_tipo_lancamento
   - contas_bancarias
   - configuracao_contabil_header
   |
   v
3. Job de classificacao XTPG preenche ItemFluxodeCaixa
   |
   v
4. Views XTPG selecionam registros elegiveis
   - XRT_SendPrevPagto
   - XRT_SendFlux
   |
   v
5. Jobs de envio montam e enviam SOAP ao DeepXRT
   - SendPrev: previsto
   - SendFlux: realizado
   |
   v
6. Backend grava logs e write-back em registros_contabeis
   - StatusParaEnvio
   - IdXRT
   |
   v
7. XTPG Saida disponibiliza movimentos contabeis
   |
   v
8. Backend processa saida por LOTE/PAR_CONTABIL
   |
   v
9. Backend cria LCM no S/4
   |
   v
10. Backend devolve status C/E ao XTPG
```

Leitura pratica:

- A classificacao deve acontecer antes do envio, porque as views de envio dependem de item de fluxo valido.
- `SendPrev` e `SendFlux` sao fluxos de saida do backend para o XTPG.
- `xtpgProcessarSaidaJob` e o caminho inverso: sai do XTPG e entra no SAP/S4.
- O backend sempre tenta gravar evidencias antes ou junto das chamadas externas, para permitir reprocessamento controlado.

## Ordem dos Jobs

### 1. `classificacao_fluxo_caixa_xtpg`

Arquivo:

- `src/cron/jobs/classificacaoFluxoCaixaXtpgJob.ts`

Service:

- `src/cron/modules/fluxo-caixa-xtpg/services/DeduzirItemFluxoCaixaXtpgService.ts`

Responsabilidade:

- preencher `registros_contabeis.ItemFluxodeCaixa`;
- marcar erro de classificacao quando cadastro/regra nao permite deduzir o item;
- evitar reprocessar a mesma falha indefinidamente.

Este job deve rodar antes dos envios para reduzir linhas bloqueadas pelas views.

### 2. `xtpg_enviar_previsto`

Arquivo:

- `src/cron/jobs/xtpgEnviarPrevistoJob.ts`

Service:

- `src/cron/modules/xtpg-envio/services/EnviarPrevistoXtpgService.ts`

Origem:

- view `XRT_SendPrevPagto`

Destino:

- SOAP XTPG `Entrada.asmx`, operacao de envio de lista de movimento de caixa.

Responsabilidade:

- enviar movimentos previstos ao XTPG via `SendPrev`;
- gravar logs em `xtpg_envio_previsto_header` e `xtpg_envio_previsto_detail`;
- atualizar `registros_contabeis.StatusParaEnvio` e `IdXRT`.

### 3. `xtpg_enviar_realizado`

Arquivo:

- `src/cron/jobs/xtpgEnviarRealizadoJob.ts`

Service:

- `src/cron/modules/xtpg-envio/services/EnviarRealizadoXtpgService.ts`

Origem:

- view `XRT_SendFlux`

Destino:

- SOAP XTPG `Entrada.asmx`, operacao de envio de lista de movimento de caixa.

Responsabilidade:

- enviar movimentos realizados ao XTPG via `SendFlux`;
- gravar logs em `xtpg_envio_realizado_header` e `xtpg_envio_realizado_detail`;
- atualizar `registros_contabeis.StatusParaEnvio`, `IdXRT`, campos `sav_*` e marcacoes auxiliares de pagamento/referencia.

### 4. `xtpg_processar_saida`

Arquivo:

- `src/cron/jobs/xtpgProcessarSaidaJob.ts`

Service:

- `src/cron/modules/xtpg-saida/services/ProcessarSaidaXtpgService.ts`

Origem:

- SOAP XTPG `Saida.asmx`, metodo `ListarMovimentosContabeisPeloStatus`.

Destino:

- SAP/S4, via `IntegracaoSapCreateJournalEntryService`.
- SOAP XTPG `Saida.asmx`, metodo `MudarStatusMovimentoParContabil`.

Responsabilidade:

- listar movimentos pendentes no XTPG;
- agrupar por `PAR_CONTABIL` e `LOTE`;
- montar e enviar LCM ao S/4;
- devolver sucesso ou erro ao XTPG.

## Glossario

- XTPG: nome usado no projeto para a integracao DeepXRT relacionada a tesouraria/fluxo de caixa.
- DeepXRT: sistema externo acessado via SOAP.
- SendPrev: envio de movimentos previstos ao XTPG.
- SendFlux: envio de movimentos realizados ao XTPG.
- Saida XTPG: fluxo em que o XTPG disponibiliza movimentos contabeis para o backend criar LCM no S/4.
- LCM: lancamento contabil, implementado como Journal Entry no S/4.
- PAR_CONTABIL: agrupador de movimentos retornados pelo XTPG. Cada PAR gera um LCM.
- LOTE: agrupador maior retornado pelo XTPG. Quando preenchido, varios PARs do mesmo lote sao tratados de forma atomica.
- StatusParaEnvio: campo em `registros_contabeis` que controla o estado do envio ao XTPG.
- IdXRT: identificador retornado pelo XTPG apos receber um movimento.
- De-para: cadastro que converte codigos do legado/XTPG/B1 para codigos aceitos no S/4.
- ChaveValidacao: chave anti-duplicidade da saida, formada por `pfjCodigo-parContabil`.

## Mapa de Codigo

Arquivos principais:

- `src/cron/modules/fluxo-caixa-xtpg`: classificacao automatica do item de fluxo de caixa.
- `src/modules/fluxo-caixa-xtpg`: APIs administrativas de cadastros XTPG.
- `src/cron/modules/xtpg-envio`: envio de previsto e realizado ao XTPG.
- `src/modules/xtpg-envio`: APIs de consulta e reprocessamento dos envios.
- `src/cron/modules/xtpg-saida`: leitura da saida XTPG e criacao de LCM no S/4.
- `prisma/s4_extensao_dotz/schema.prisma`: modelos de registros, logs e cadastros.
- `prisma/s4_extensao_dotz/manual_sql`: views, funcoes e ajustes SQL relacionados ao XTPG.

Arquivos de orquestracao:

- `src/cron/modules/fluxo-caixa-xtpg/services/DeduzirItemFluxoCaixaXtpgService.ts`
- `src/cron/modules/xtpg-envio/services/EnviarXtpgBaseService.ts`
- `src/cron/modules/xtpg-envio/services/xtpgEnvioFactory.ts`
- `src/cron/modules/xtpg-saida/services/ProcessarSaidaXtpgService.ts`
- `src/modules/xtpg-envio/services/ReprocessarXtpgService.ts`

Documentacao complementar:

- `XTPG_CLASSIFICACAO_FLUXO_CAIXA_JOB.md`: detalhes completos do job `classificacao_fluxo_caixa_xtpg`.

Arquivos de mapeamento:

- `src/cron/modules/xtpg-envio/config/xtpgFieldMap.ts`
- `src/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg.ts`
- `src/cron/modules/xtpg-saida/mappers/buildLcmFromMovimentos.ts`

Clientes externos:

- `src/cron/modules/xtpg-envio/soap/XtpgSoapClient.ts`
- `src/cron/modules/xtpg-saida/soap/XtpgSaidaSoapClient.ts`
- `src/modules/documento-fiscal/utils/IntegracaoSapCreateJournalEntry.ts`

## Cadastros de Apoio

Os cadastros abaixo sustentam a classificacao, o envio e a saida. Quando um fluxo falha, a causa mais comum e de-para ausente ou incompleto.

### `FluxoCaixaCiaParceiro`

Modulo HTTP:

- `/fluxo-caixa-xtpg`

Modelo:

- `FluxoCaixaCiaParceiro`

Finalidade:

- vincular fornecedor/parceiro (`cardCode`) e empresa (`companyCode`) a um `itemFluxoCaixa`.

Uso:

- classificacao automatica, como fallback por parceiro.

Regras na criacao/alteracao:

- normaliza `companyCode`;
- valida `cardCode`;
- valida tamanho maximo de `itemFluxoCaixa`;
- opcionalmente confere se o fornecedor existe e esta ativo em `dotz-stage.OCRD`;
- bloqueia duplicidade por `cardCode + companyCode`.

### `FluxoCaixaCiaTipoLancamento`

Modelo:

- `FluxoCaixaCiaTipoLancamento`

Finalidade:

- deduzir item de fluxo de caixa por combinacao de campos do registro contabil.

Chave funcional:

- `companyCode`
- `postingKey`
- `documentType`
- `referenceDocumentType`
- `isReversed`
- `reversalReason`
- `debitCreditCode`

Uso:

- classificacao automatica, depois de tentar conta default, reversao, clearing e contrapartida.

### `ContasContabeis`

Modelo:

- `ContasContabeis`

Uso no XTPG:

- define se uma conta e elegivel para classificacao XTPG (`XtpgAtivado`);
- fornece `ItemFluxoDeCaixa` default quando existir;
- participa da deducao por contrapartida;
- faz de-para de conta B1/XTPG para conta S/4 na saida (`gl_account_b1_xtpg`);
- fornece centro de custo/lucro usados no LCM quando aplicavel.

Campos relevantes:

- `CompanyCode`
- `ChartOfAccounts`
- `GLAccount`
- `ItemFluxoDeCaixa`
- `XtpgAtivado`
- `gl_account_b1_xtpg`
- centro de custo
- centro de lucro
- `DataAlteracao`

### `ContasBancarias`

Uso no XTPG:

- faz de-para bancario na saida XTPG.

Entrada esperada na saida:

- banco;
- agencia;
- conta;
- conta contabil;
- empresa.

Saida esperada:

- `HouseBank`;
- `HouseBankAccount`.

Se um movimento usa banco e nao existe de-para, o `PAR_CONTABIL` inteiro fica com erro.

### `ConfiguracaoContabilHeader`

Uso no XTPG:

- fornece configuracao contabil para montar LCM da saida.

Filtro usado:

- `tipoProcesso = XTPG_R`

Campos funcionais:

- tipo AR/AP/GL;
- tipo de documento;
- texto de documento;
- demais campos usados no payload de Journal Entry.

## Fluxo 1 - Classificacao de Fluxo de Caixa

### Objetivo

Preencher `ItemFluxodeCaixa` em `registros_contabeis` para que as views `XRT_SendPrevPagto` e `XRT_SendFlux` possam selecionar registros prontos para envio ao XTPG.

### Entrada

Tabela:

- `registros_contabeis`

Candidatos:

- linhas sem erro de classificacao;
- linhas com `ItemFluxodeCaixa` nulo ou reservado;
- limite definido por `CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE`;
- ordenacao por `PostingDate desc` e `CompanyCode asc`.

Itens reservados/invalidos:

- tratados em `ITEM_FLUXO_XTPG_RESERVADOS`;
- validacao central em `isValidClassifiedItemFluxoXtpg`.

### Saida

Sucesso:

- atualiza `ItemFluxodeCaixa`;
- limpa `XtpgClassificacaoErro`;
- limpa `XtpgClassificacaoErroEm`.

Erro:

- preenche `XtpgClassificacaoErro`;
- preenche `XtpgClassificacaoErroEm`.

### Ordem Interna

```text
1. Reabrir linhas com erro quando cadastro de conta foi atualizado
2. Buscar candidatos
3. Separar linhas que ja possuem item valido
4. Buscar linhas irmas dos mesmos documentos
5. Montar lookup de contas contabeis elegiveis
6. Prefetch de documentos de reversao e clearing
7. Prefetch de regras por tipo de lancamento
8. Prefetch de vinculos por parceiro
9. Deduzir item linha a linha
10. Atualizar sucessos em transacao
11. Atualizar erros em transacao
12. Registrar resumo no log
```

### Prioridade de Deducao

Para cada linha, `deduceOne` tenta resolver nesta ordem:

```text
1. Validar se a conta contabil da linha e elegivel para XTPG
2. Usar ItemFluxoDeCaixa default da propria conta contabil
3. Copiar item do documento original em caso de reversao
4. Copiar item do documento compensado em caso de clearing
5. Deduzir pela contrapartida do mesmo documento
6. Deduzir por regra de tipo de lancamento por CIA
7. Deduzir por parceiro/fornecedor/cliente
8. Se nada resolver, gravar erro generico de classificacao
```

Detalhes importantes:

- Uma conta sem `XtpgAtivado = true` falha com erro de conta inelegivel.
- A deducao por contrapartida procura linhas irmas do mesmo documento com sinal oposto e prioriza maior valor absoluto.
- A deducao por parceiro usa `Supplier` ou `Customer`; primeiro tenta empresa exata, depois fallback sem empresa.
- Linhas com erro nao voltam a ser candidatas em todo ciclo. Elas so sao reabertas quando `contas_contabeis.DataAlteracao` for maior que `XtpgClassificacaoErroEm`.

## Fluxo 2 - XTPG Entrada/Envio

Este fluxo envia movimentos para o XTPG. Existem dois sabores:

- PREVISTO: `SendPrev`, origem na view `XRT_SendPrevPagto`.
- REALIZADO: `SendFlux`, origem na view `XRT_SendFlux`.

Ambos usam a mesma orquestracao:

- `EnviarXtpgBaseService`

As diferencas de view, tabela de log, batch size e mapeamento sao injetadas por:

- `xtpgEnvioFactory.ts`
- `EnviarPrevistoXtpgService.ts`
- `EnviarRealizadoXtpgService.ts`

### Entrada

PREVISTO:

- view configurada por `XTPG_VIEW_PREVISTO`;
- default esperado: `XRT_SendPrevPagto`;
- batch size: `XTPG_SEND_PREV_BATCH_SIZE`;
- max por execucao: `XTPG_SEND_PREV_MAX_PER_RUN`.

REALIZADO:

- view configurada por `XTPG_VIEW_REALIZADO`;
- default esperado: `XRT_SendFlux`;
- batch size: `XTPG_SEND_FLUX_BATCH_SIZE`;
- max por execucao: `XTPG_SEND_FLUX_MAX_PER_RUN`.

As views normalmente retornam somente registros com `status_para_envio is null`, alem dos filtros de negocio.

### Ordem Interna do Envio

```text
1. Job chama o service do fluxo
2. Service aplica guard de reentrada por fluxo
3. Repository le a view ate maxPerRun
4. Cada linha da view vira MovimentoResolvido
5. Movimentos sao quebrados em lotes pelo batchSize
6. Para cada lote, monta request SOAP
7. Cria header de log com status PROCESSANDO
8. Cria details denormalizados, um por movimento
9. Marca registros_contabeis como PROCESSANDO_* antes do POST
10. Envia lote ao XTPG via SOAP
11. Faz parse do retorno por movimento
12. Atualiza details com ENVIADO/ERRO, id_xrt e mensagem
13. Se nao houve falha de transporte, atualiza registros_contabeis com SUCESSO_* ou ERRO_*
14. Se houve falha de transporte, mantem registros_contabeis em PROCESSANDO_*
15. Fecha header como ENVIADO, PARCIAL ou ERRO
16. Remove fluxo do guard de reentrada
```

### Por que marca `PROCESSANDO_*` antes do POST

Esta e a regra central de idempotencia do envio.

As views selecionam registros nao enviados. Se o backend fizesse POST no XTPG e sofresse crash antes de gravar sucesso, a proxima execucao poderia selecionar a mesma linha e duplicar o movimento. Para reduzir esse risco, o service marca as linhas como processando antes da chamada externa.

Estados:

- antes do POST: `PROCESSANDO_PREV` ou `PROCESSANDO_FLUX`;
- sucesso XTPG: `SUCESSO_PREV` ou `SUCESSO_FLUX`, com `IdXRT`;
- erro de negocio XTPG: `ERRO_PREV` ou `ERRO_FLUX`;
- falha de transporte/lote: permanece `PROCESSANDO_*`, porque o resultado externo e desconhecido.

Registros presos em `PROCESSANDO_*` exigem decisao operacional: pode ter enviado e nao gravado resposta, ou pode nao ter chegado ao XTPG.

### Status de Header

Tabelas:

- `XtpgEnvioPrevistoHeader`
- `XtpgEnvioRealizadoHeader`

Valores:

- `PROCESSANDO`: lote criado e ainda em andamento.
- `ENVIADO`: todos os movimentos foram aceitos pelo XTPG.
- `PARCIAL`: parte dos movimentos foi aceita e parte teve erro.
- `ERRO`: lote falhou ou nenhum movimento foi aceito.

### Status de Detail

Tabelas:

- `XtpgEnvioPrevistoDetail`
- `XtpgEnvioRealizadoDetail`

Valores:

- `ENVIADO`: movimento aceito pelo XTPG.
- `ERRO`: movimento rejeitado, sem retorno valido ou com mensagem de erro.

### Write-back em `registros_contabeis`

Campo:

- `StatusParaEnvio`

Valores usados:

- `PROCESSANDO_PREV`
- `SUCESSO_PREV`
- `ERRO_PREV`
- `PROCESSANDO_FLUX`
- `SUCESSO_FLUX`
- `ERRO_FLUX`

Campos adicionais:

- `IdXRT`: gravado no sucesso.
- `EnvioID`: gravado no sucesso quando aplicavel.
- `UltPkEnviada`: gravado quando o spec fornece write-back.
- `SavClearAccDoc`, `SavClearDocFiscalYear`, `SavClearItem`, `SavRevDoc`, `SavRevDocFiscalYear`: gravados no realizado para manter rastreabilidade de clearing/reversao.

No realizado, o service tambem pode marcar documento de referencia com o mesmo status de sucesso usando os campos `sav_*`.

## Diferencas entre Previsto e Realizado

### PREVISTO - `XRT_SendPrevPagto`

Caracteristicas:

- envia tag `Historico`;
- `Temperatura` e constante `1`;
- `ContaContabil` vem de `AcctCode`;
- `InformacoesContabeis` vem de `AcctCode`;
- datas de caixa, competencia e pagamento usam `Vencimento`;
- `OrigemPk` vem de `DocEntry`;
- chave de origem para write-back pode ser montada por `Company_code`, `fiscal_year`, `accounting_document`, `Accounting_document_item`;
- moeda e constante `BRL`.

### REALIZADO - `XRT_SendFlux`

Caracteristicas:

- nao envia tag `Historico`;
- `Temperatura` vem da coluna `temperatura`;
- `ContaContabil` vem de `Conta_contabil`;
- `InformacoesContabeis` vem de `Conta_contrapartida`;
- `OrigemSistema` vem de `Diario_original2`;
- datas de caixa, competencia e pagamento usam `Data_de_lancamento`;
- `OrigemPk` vem de `Chave_da_transacao`;
- congela campos `sav_*` de clearing/reversao;
- usa fallback `p_*` quando os campos de clearing estao vazios em cenarios de reversao.

## Mapeamento de Tags SOAP

Fonte principal:

- `src/cron/modules/xtpg-envio/config/xtpgFieldMap.ts`

Cada fluxo tem uma lista ordenada de tags. A ordem dessa lista vira a ordem do XML enviado ao DeepXRT.

Tags usadas:

- `PfjNome`
- `PfjCpf`
- `BanCodigo`
- `AgeCodigo`
- `CntCodigo`
- `TdpCodigo`
- `DocPagador`
- `PfjCodigo`
- `ValorOriginal`
- `Valor`
- `DocOrigem`
- `Historico`
- `ContaContabil`
- `Temperatura`
- `OrigemSistema`
- `OrigemPk`
- `MmiCodigo`
- `InformacoesContabeis`
- `DataCaixa`
- `DataCompetencia`
- `DataPagamento`
- `Dff01`
- `Dff02`
- `MoedaCodigo`

Transformacoes suportadas no mapeamento:

- `raw`: envia valor como texto normalizado.
- `valor`: formata valor monetario/numerico conforme esperado pelo XTPG.
- `dateIso`: transforma data para formato ISO.
- `const`: envia constante.
- `nowYmd`: envia data atual no formato `yyyyMMdd`.

Para alterar coluna, constante, formato ou limite de tamanho, o ponto normal de manutencao e `xtpgFieldMap.ts`.

## Reprocessamento de XTPG Entrada

Endpoint:

- `POST /xtpg-envios/:fluxo/reprocessar`

Service:

- `src/modules/xtpg-envio/services/ReprocessarXtpgService.ts`

Fluxos suportados:

- `previsto`
- `realizado`

Modos:

- `resetar`: limpa `StatusParaEnvio` e `IdXRT` em `registros_contabeis`; o cron pode reenviar depois.
- `reenviar`: reconstrui o movimento a partir do detail e reenvia imediatamente, criando novo header/detail e fazendo novo write-back.

Elegibilidade:

- details com status `ERRO`;
- registros cujo `StatusParaEnvio` esteja em `PROCESSANDO_*`.

Nao elegivel:

- movimentos ja enviados com sucesso.

Ordem do modo `resetar`:

```text
1. Buscar details pelos IDs recebidos
2. Carregar status atual de registros_contabeis pelas chaves de origem
3. Filtrar somente ERRO ou PROCESSANDO_*
4. Para cada elegivel, setar StatusParaEnvio = null e IdXRT = null
5. Retornar quantidade resetada e ignorada
```

Ordem do modo `reenviar`:

```text
1. Buscar details pelos IDs recebidos
2. Carregar status atual de registros_contabeis pelas chaves de origem
3. Filtrar somente ERRO ou PROCESSANDO_*
4. Obter spec do fluxo
5. Reconstruir MovimentoResolvido a partir do detail
6. Chamar createEnviarXtpgService(fluxo).processar(movimentos)
7. Seguir o mesmo fluxo de lote/log/SOAP/write-back do envio normal
```

## Fluxo 3 - XTPG Saida para LCM no S/4

Este fluxo faz o caminho inverso do envio: o XTPG disponibiliza movimentos contabeis e o backend cria lancamentos no SAP/S4.

### Entrada

SOAP:

- `Saida.asmx`

Metodo de listagem:

- `ListarMovimentosContabeisPeloStatus`

Status consultado:

- `XTPG_SAIDA_STATUS_BUSCA`
- default logico: `I`

### Saida

SAP/S4:

- cria Journal Entry via `IntegracaoSapCreateJournalEntryService`.

XTPG:

- devolve status por `MudarStatusMovimentoParContabil`.

Status enviados ao XTPG:

- sucesso: `XTPG_SAIDA_STATUS_SUCESSO`, default `C`;
- erro: `XTPG_SAIDA_STATUS_ERRO`, default `E`.

### Ordem Interna da Saida

```text
1. Listar movimentos no XTPG pelo status configurado
2. Se a listagem falhar, registrar erro e encerrar execucao
3. Agrupar movimentos por PAR_CONTABIL
4. Agrupar PARs por LOTE
5. Para cada grupo de lote, preparar todos os PARs sem enviar ao SAP
6. Para PAR ja integrado no SAP, refazer somente retorno ao XTPG quando necessario
7. Se algum PAR pendente falhar na preparacao, cancelar o lote inteiro
8. Se envio SAP estiver desabilitado, parar apos montar e gravar requestSap
9. Se todos os PARs pendentes estiverem validos, integrar todos os LCMs no S/4
10. Se algum LCM falhar no S/4, estornar LCMs ja criados no mesmo lote
11. Em caso de falha de preparacao ou SAP, devolver erro E ao XTPG para os PARs pendentes
12. Se todos os LCMs forem criados com sucesso, devolver OK C ao XTPG para todos os PARs
```

### Agrupamento

`PAR_CONTABIL`:

- e a unidade de LCM;
- todos os movimentos do mesmo PAR entram no mesmo Journal Entry;
- gera um header em `xtpg_saida_header`;
- gera N detalhes em `xtpg_saida_detail`.

`LOTE`:

- quando preenchido, agrupa varios PARs;
- todos os PARs do mesmo lote sao processados de forma atomica;
- se um PAR falha, nenhum PAR pendente do lote deve receber OK no XTPG.

Quando `LOTE` vem vazio:

- o PAR e tratado em um grupo individual;
- nao ha cancelamento cruzado com outros PARs sem lote.

### Fase 1 - Preparacao do PAR

Metodo:

- `prepararPar`

Ordem:

```text
1. Montar chaveValidacao = pfjCodigo-parContabil
2. Procurar header existente por chaveValidacao
3. Se statusSap = INTEGRADO, marcar como jaIntegrado e nao recriar LCM
4. Resolver empresa: PFJ_CODIGO -> CIA/CompanyCode
5. Buscar configuracao contabil com tipoProcesso = XTPG_R
6. Para cada movimento, resolver de-para bancario quando usa banco
7. Para cada movimento, resolver conta B1/XTPG -> conta S/4
8. Carregar centro de custo/lucro da conta S/4
9. Se nao houver erros de de-para/configuracao, montar JSON do LCM
10. Persistir ou atualizar header e details
11. Detectar debito e credito na mesma conta S/4 que zerariam a linha
12. Retornar preparo com integracaoJson ou descricaoErro
```

Erros de preparacao:

- empresa nao encontrada no de-para `cia`;
- configuracao contabil `XTPG_R` ausente;
- conta bancaria sem correspondencia em `contas_bancarias`;
- conta B1/XTPG sem de-para para S/4 em `contas_contabeis.gl_account_b1_xtpg`;
- debito e credito na mesma conta contabil apos agregacao.

Mesmo com erro, o backend persiste header/detail para rastreabilidade.

### Fase 2 - Decisao de Lote

Metodo:

- `decidirCancelamentoLote`

Regra:

- se qualquer PAR pendente tiver `descricaoErro`, o lote inteiro e cancelado;
- PARs ja integrados no SAP nao sao recriados;
- PARs pendentes sem erro tambem recebem erro se outro PAR do mesmo lote falhou.

Motivo:

- evitar que o XTPG receba OK de parte do lote e erro de outra parte.

### Fase 3 - Gate de Envio ao SAP

Variavel:

```text
XTPG_SAIDA_ENVIO_SAP_HABILITADO
```

Quando `false`:

- lista movimentos;
- valida de-paras;
- monta `requestSap`;
- grava header/detail;
- nao chama o SAP/S4;
- nao devolve OK ao XTPG.

Quando `true`:

- chama `createJournalEntry`;
- atualiza `statusSap`, `codigoSap`, `responseSap` e datas;
- devolve `C` ou `E` ao XTPG.

Este gate existe porque a saida XTPG cria lancamentos contabeis reais.

### Fase 4 - Integracao SAP

Metodo:

- `integrarLcmSap`

Ordem:

```text
1. Enviar integracaoJson para createJournalEntry
2. Extrair codigo SAP da resposta
3. Atualizar header como statusSap = INTEGRADO
4. Gravar codigoSap, dataIntegracaoSap e responseSap
5. Em caso de erro, extrair HTTP/status/mensagem
6. Atualizar header como statusSap = ERRO
7. Retornar sucesso ou erro para a decisao do lote
```

Importante:

- esta fase nao toca no XTPG;
- o OK ao XTPG so ocorre depois que todo o lote foi integrado com sucesso.

### Fase 5 - Retorno ao XTPG

Sucesso:

- metodo `enviarOkXtpg`;
- envia status `C`;
- envia `codigoSap` como critica;
- atualiza `statusXtpg = INTEGRADO` quando XTPG aceita.

Erro:

- metodo `devolverErroXtpg`;
- envia status `E`;
- envia motivo truncado como critica;
- atualiza `statusXtpg = ERRO_DEVOLVIDO` quando XTPG aceita;
- atualiza `statusXtpg = ERRO` quando a devolucao falha.

### Estorno por Cancelamento de Lote

Quando um PAR do lote falha no S/4 depois de outros PARs ja terem criado LCM, o backend tenta estornar os LCMs criados.

Metodo:

- `estornarLcmSap`

Como funciona:

- reutiliza o `createJournalEntry`;
- inverte o sinal dos valores;
- prefixa texto com `EST`;
- atualiza o header original como `statusSap = ESTORNADO`;
- se o estorno falhar, registra mensagem pedindo atencao manual.

Observacao:

- e um lancamento compensador, nao necessariamente um estorno formal via endpoint especifico de reversao.

## Status da Saida

### `statusSap`

Tabela:

- `XtpgSaidaHeader`

Valores:

- `AGUARDANDO`: PAR preparado e aguardando envio ao SAP.
- `INTEGRADO`: LCM criado no S/4.
- `ERRO`: falha de de-para, configuracao, montagem ou integracao SAP.
- `ESTORNADO`: LCM criado foi compensado por cancelamento atomico de lote.

### `statusXtpg`

Tabela:

- `XtpgSaidaHeader`

Valores:

- `INTEGRADO`: retorno OK enviado ao XTPG.
- `ERRO`: tentativa de retorno ao XTPG falhou.
- `ERRO_DEVOLVIDO`: erro devolvido com sucesso ao XTPG.

## Idempotencia

### Entrada/Envio

Chave de write-back:

- PK composta de `registros_contabeis`: `CompanyCode`, `FiscalYear`, `AccountingDocument`, `AccountingDocumentItem`.

Protecoes:

- guard de reentrada em memoria por fluxo;
- pre-marcacao `PROCESSANDO_*` antes do POST;
- views filtrando registros ainda nao enviados;
- sucesso grava `IdXRT`;
- falha de transporte mantem `PROCESSANDO_*` para decisao manual.

Risco operacional:

- resetar `PROCESSANDO_*` sem confirmar o que aconteceu no XTPG pode duplicar movimento.

### Saida

Chave anti-duplicidade:

```text
pfjCodigo-parContabil
```

No codigo/modelo:

- `chaveValidacao`

Matriz:

- `statusSap = INTEGRADO`: nunca recria o LCM; refaz apenas retorno ao XTPG se necessario.
- `statusSap = ERRO`: pode reprocessar fila SAP.
- `statusXtpg = ERRO`: pode reprocessar somente retorno ao XTPG quando SAP ja integrou.
- `statusXtpg = INTEGRADO`: nada a fazer.

Regra critica:

- nao recriar LCM quando o SAP ja integrou.

## Logs e Tabelas

### Registro base

Modelo:

- `AccountingDocumentItem`

Tabela:

- `registros_contabeis`

Campos XTPG relevantes:

- `ItemFluxodeCaixa`
- `StatusParaEnvio`
- `IdXRT`
- `XtpgClassificacaoErro`
- `XtpgClassificacaoErroEm`
- `SavClearAccDoc`
- `SavClearDocFiscalYear`
- `SavClearItem`
- `SavRevDoc`
- `SavRevDocFiscalYear`
- `UltPkEnviada`
- `EnvioID`

### Logs de Entrada

Previsto:

- `xtpg_envio_previsto_header`
- `xtpg_envio_previsto_detail`

Realizado:

- `xtpg_envio_realizado_header`
- `xtpg_envio_realizado_detail`

Header representa:

- uma requisicao/lote;
- status geral;
- total de registros;
- XML request;
- XML response;
- mensagem de erro do lote.

Detail representa:

- um movimento enviado;
- campos denormalizados do payload;
- status individual;
- `idXrt`;
- mensagem de erro;
- origem usada no write-back.

### Logs de Saida

Tabelas:

- `xtpg_saida_header`
- `xtpg_saida_detail`

Header representa:

- um `PAR_CONTABIL`;
- empresa resolvida;
- chave de validacao;
- status SAP;
- status XTPG;
- request/response SAP;
- request/response XTPG;
- codigo SAP;
- descricoes de erro.

Detail representa:

- movimentos recebidos do XTPG dentro do PAR;
- conta B1/XTPG original;
- conta S/4 resolvida;
- banco/agencia/conta;
- House Bank resolvido;
- valor, historico e sinal debito/credito.

## Variaveis de Ambiente

### Entrada/Envio

- `XTPG_API_BASE_URL`
- `XTPG_API_ENDPOINT`
- `XTPG_API_USUARIO`
- `XTPG_API_SENHA`
- `XTPG_API_TIMEOUT_MS`
- `XTPG_VIEW_DATASOURCE`
- `XTPG_VIEW_PREVISTO`
- `XTPG_VIEW_REALIZADO`
- `CRON_XTPG_SEND_PREV`
- `CRON_XTPG_SEND_PREV_ENABLED`
- `XTPG_SEND_PREV_BATCH_SIZE`
- `XTPG_SEND_PREV_MAX_PER_RUN`
- `CRON_XTPG_SEND_FLUX`
- `CRON_XTPG_SEND_FLUX_ENABLED`
- `XTPG_SEND_FLUX_BATCH_SIZE`
- `XTPG_SEND_FLUX_MAX_PER_RUN`

### Saida

- `XTPG_SAIDA_API_BASE_URL`
- `XTPG_SAIDA_API_ENDPOINT`
- `XTPG_SAIDA_STATUS_BUSCA`
- `XTPG_SAIDA_STATUS_SUCESSO`
- `XTPG_SAIDA_STATUS_ERRO`
- `CRON_XTPG_SAIDA`
- `CRON_XTPG_SAIDA_ENABLED`
- `XTPG_SAIDA_ENVIO_SAP_HABILITADO`

### Classificacao

- `CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG`
- `CRON_CLASSIFICACAO_FLUXO_CAIXA_XTPG_ENABLED`
- `CLASSIFICACAO_FLUXO_CAIXA_XTPG_BATCH_SIZE`

## Endpoints Internos

### Cadastros XTPG

- `GET /fluxo-caixa-xtpg/fornecedores/combobox`
- `GET /fluxo-caixa-xtpg/fornecedores`
- `GET /fluxo-caixa-xtpg/parceiros/vinculos`
- `GET /fluxo-caixa-xtpg/parceiro-vinculo`
- `POST /fluxo-caixa-xtpg/parceiro-vinculo`
- `PUT /fluxo-caixa-xtpg/parceiro-vinculo`
- `DELETE /fluxo-caixa-xtpg/parceiro-vinculo`
- `GET /fluxo-caixa-xtpg/tipo-lancamento`
- `GET /fluxo-caixa-xtpg/tipo-lancamento/detail`
- `POST /fluxo-caixa-xtpg/tipo-lancamento`
- `PUT /fluxo-caixa-xtpg/tipo-lancamento`
- `DELETE /fluxo-caixa-xtpg/tipo-lancamento`
- `POST /fluxo-caixa-xtpg/classificar-lote`

### Consulta e Reprocessamento de Envios

- `GET /xtpg-envios/:fluxo/headers`
- `GET /xtpg-envios/:fluxo/headers/:id`
- `POST /xtpg-envios/:fluxo/reprocessar`

### Registros Contabeis

- `GET /registros-contabeis`
- `GET /registros-contabeis/itens-fluxo`
- `PUT /registros-contabeis/:companyCode/:fiscalYear/:accountingDocument/:accountingDocumentItem/item-fluxo`

### Disparo Manual de Jobs

- `GET /integracoes`
- `POST /integracoes/:key/run`

Keys relevantes:

- `classificacao_fluxo_caixa_xtpg`
- `xtpg_enviar_previsto`
- `xtpg_enviar_realizado`
- `xtpg_processar_saida`

## Como Investigar Problemas

### Classificacao

Ordem sugerida:

```text
1. Verificar registros_contabeis.XtpgClassificacaoErro
2. Conferir se a conta existe em contas_contabeis
3. Conferir se XtpgAtivado = true
4. Conferir ItemFluxoDeCaixa default da conta
5. Conferir regras de tipo de lancamento
6. Conferir vinculos por parceiro
7. Atualizar cadastro
8. Rodar o job ou aguardar o proximo ciclo
```

Se a linha ja tinha erro, lembre que ela so volta a ser candidata automaticamente quando o cadastro da conta e atualizado.

### Envio Previsto/Realizado

Ordem sugerida:

```text
1. Consultar GET /xtpg-envios/:fluxo/headers
2. Abrir o header mais recente
3. Verificar status, request, response e mensagemErro
4. Verificar details com status ERRO
5. Conferir origemDocEntry do detail
6. Conferir registros_contabeis.StatusParaEnvio
7. Se estiver PROCESSANDO_*, tratar como resposta desconhecida
8. Usar resetar ou reenviar apenas com certeza operacional
```

Perguntas uteis:

- A view ainda retorna o registro?
- O registro foi pre-marcado como `PROCESSANDO_*`?
- O XTPG retornou `ID` valido?
- A falha e de negocio por movimento ou de transporte do lote?
- O header ficou `PROCESSANDO`, `PARCIAL` ou `ERRO`?

### Saida XTPG

Ordem sugerida:

```text
1. Verificar CRON_XTPG_SAIDA_ENABLED
2. Verificar XTPG_SAIDA_ENVIO_SAP_HABILITADO
3. Consultar xtpg_saida_header por chaveValidacao, parContabil ou ciaSap
4. Conferir statusSap e statusXtpg
5. Conferir requestSap e responseSap
6. Conferir descricaoSap
7. Conferir requestXtpg e responseXtpg
8. Conferir descricaoXtpg e criticaXtpg
9. Se statusSap = INTEGRADO e statusXtpg = ERRO, reprocessar somente retorno XTPG
10. Se statusSap = ESTORNADO, validar lancamento compensador no S/4
```

Perguntas uteis:

- O XTPG retornou movimentos com status esperado?
- O `PAR_CONTABIL` veio em lote?
- Algum PAR do mesmo lote falhou e cancelou todos?
- Faltou de-para de empresa, banco, conta contabil ou configuracao `XTPG_R`?
- O envio ao S/4 estava habilitado?
- O SAP criou LCM mas o retorno ao XTPG falhou?

## Cuidados Antes de Alterar

- Nao alterar status de envio sem entender a idempotencia.
- Nao resetar `PROCESSANDO_*` automaticamente em massa; isso pode duplicar movimento no XTPG.
- Nao recriar LCM quando `statusSap = INTEGRADO`.
- Mudancas no mapeamento de tags devem ser feitas preferencialmente em `xtpgFieldMap.ts`.
- Mudancas nas views podem quebrar o contrato de envio; conferir nomes de colunas e filtros.
- Mudancas em `contas_contabeis` afetam classificacao, envio e saida.
- Mudancas em `contas_bancarias` afetam a saida XTPG.
- O gate `XTPG_SAIDA_ENVIO_SAP_HABILITADO` protege criacao real de lancamentos contabeis.
- Em lote atomico, erro de um PAR pode cancelar todos os PARs pendentes do mesmo lote.
- Falha ao estornar LCM exige atencao manual, porque o LCM original pode permanecer no S/4.

## Checklist para Dev Novo

Para entender o XTPG na pratica, leia nesta ordem:

1. Este arquivo.
2. `src/cron/modules/xtpg-envio/README.md`.
3. `src/cron/modules/xtpg-saida/README.md`.
4. `src/cron/modules/fluxo-caixa-xtpg/services/DeduzirItemFluxoCaixaXtpgService.ts`.
5. `src/cron/modules/xtpg-envio/services/EnviarXtpgBaseService.ts`.
6. `src/cron/modules/xtpg-envio/config/xtpgFieldMap.ts`.
7. `src/cron/modules/xtpg-envio/mappers/buildMovimentoXtpg.ts`.
8. `src/modules/xtpg-envio/services/ReprocessarXtpgService.ts`.
9. `src/cron/modules/xtpg-saida/services/ProcessarSaidaXtpgService.ts`.
10. `src/cron/modules/xtpg-saida/mappers/buildLcmFromMovimentos.ts`.
11. Models XTPG em `prisma/s4_extensao_dotz/schema.prisma`.

## Checklist de Validacao Rapida

Antes de considerar o modulo saudavel em ambiente:

```text
1. Classificacao roda sem crescimento continuo de XtpgClassificacaoErro
2. Views retornam apenas registros realmente elegiveis
3. SendPrev cria header/detail e atualiza StatusParaEnvio
4. SendFlux cria header/detail, atualiza StatusParaEnvio e grava sav_*
5. Falhas de transporte deixam registros em PROCESSANDO_*
6. Reprocessamento nao permite reenviar sucesso
7. Saida grava header/detail para cada PAR_CONTABIL
8. De-paras de empresa, banco, conta e XTPG_R estao completos
9. Gate de SAP esta no valor esperado para o ambiente
10. Retorno ao XTPG so envia C depois de sucesso SAP do lote inteiro
```
