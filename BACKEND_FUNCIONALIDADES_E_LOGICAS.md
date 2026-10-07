# Backend - Funcionalidades e Logicas do Projeto

Este documento resume o backend `s4_extensao_dotz` para ajudar um dev backend a entender rapidamente a arquitetura, os modulos, os fluxos de negocio e os pontos de manutencao.

## Visao Geral

O projeto e uma API Node.js com TypeScript e Express voltada para integracoes da Dotz com SAP S/4HANA, Analyzer/stage, Vexpenses, DeepXRT/XTPG, BankPlus Invent, RabbitMQ e SQL Server.

O backend possui tres frentes principais:

- API HTTP para operacoes administrativas, documentos fiscais, vendas, relatorios, XTPG, registros contabeis e controle de despesas.
- Jobs cron que executam sincronizacoes e processamentos periodicos.
- Workers RabbitMQ que processam tarefas pesadas e integracoes com retry/DLQ.

## Stack e Comandos

- Runtime: Node.js + TypeScript, modulo CommonJS.
- Framework HTTP: Express.
- ORM: Prisma.
- Banco: SQL Server.
- Fila: RabbitMQ via `amqplib`.
- Cron: `cron-parser` com agendamento proprio em `CronManager`.
- Testes: Vitest, Supertest e MSW.
- Upload/arquivos: `multer`, storage local, Google Cloud Storage e Azure Blob em pontos especificos.
- Integracoes HTTP/SOAP: `axios`.
- Logs/observabilidade: Winston, Elasticsearch e Elastic APM.

Comandos principais:

```bash
npm run dev
npm run dev:workers
npm run build
npm start
npm run prisma:generate
npm run test:unit
npm run test:integration
```

## Estrutura Principal

- `src/index.ts`: inicia a API, sobe os cron jobs e trata shutdown.
- `src/app.ts`: configura Express, JSON, CORS, logger, rotas e error handler.
- `src/routes/index.ts`: agrega as rotas dos modulos.
- `src/modules/*`: funcionalidades HTTP, normalmente com `routes`, `controllers`, `services` e `utils`.
- `src/cron`: motor de agendamento e jobs periodicos.
- `src/queue`: producers, consumers, tipos e configuracao RabbitMQ.
- `src/database`: criacao e compartilhamento dos clients Prisma.
- `src/config/config.ts`: variaveis de ambiente centralizadas.
- `src/middlewares`: autenticacao, permissao, acesso por CIA, API key, CORS, logs e erros.
- `prisma/s4_extensao_dotz`: schema principal da aplicacao.
- `prisma/dotz-stage`: schema de leitura do stage/Analyzer.
- `prisma/relatorio-readonly`: client read-only para execucao de relatorios dinamicos.

## Bancos e Prisma

O `DatabaseManager` instancia tres clients:

- `s4_extensao_dotz`: banco principal da aplicacao. Guarda usuarios, CIAs, documentos fiscais, vendas, configuracoes contabeis, registros contabeis, logs de integracao, XTPG, despesas e relatorios.
- `dotz-stage`: base stage/Analyzer. Usada para consultar parceiros, pedidos, itens, faturamentos e dados auxiliares vindos do SAP/Analyzer.
- `relatorio-readonly`: conexao read-only usada pelo modulo de relatorios dinamicos.

Para gerar os clients:

```bash
npm run prisma:generate
```

Modelos centrais do schema principal:

- `Usuario`, `TokenResetSenha`, `GrupoUsuario`, `UsuarioGrupoUsuario`
- `Cia`
- `DocumentoFiscalHeader`, `DocumentoFiscalDetalhe`, `DocumentoFiscalPonto`, `DocumentoFiscalErrors`
- `ConfiguracaoContabil`, `ConfiguracaoContabilDetalhe`, `ConfiguracaoContabilDetalhePonto`
- `ControleExpense`
- `AccountingDocumentItem`, `ItemFluxoCaixa`
- `ContasContabeis`, `ContasBancarias`
- `FluxoCaixaCiaParceiro`, `FluxoCaixaCiaTipoLancamento`
- `Relatorio`, `RelatorioVariavel`, `RelatorioExecucaoLog`
- `VendasHeader`, `VendasDetalhe`, `VendaRecDiferida`
- `XtpgEnvioPrevistoHeader/Detail`, `XtpgEnvioRealizadoHeader/Detail`, `XtpgSaidaHeader/Detail`
- `IntegrationExecutionLog`

## Autenticacao, Autorizacao e Acesso por CIA

Autenticacao:

- `POST /auth` valida email/senha com bcrypt e retorna JWT.
- `ensureAuthenticate` exige header `Authorization: Bearer <token>`, valida JWT e busca usuario ativo.
- O token carrega o `id` do usuario; dados de perfil e status sao consultados no banco a cada request autenticado.

Autorizacao:

- Perfis suportados: `ADMIN` e `USER`.
- `permissionsRequired(Perfil.ADMIN)` protege rotas administrativas.

Acesso por CIA:

- `ensureCiaAccess` carrega em `req.user.ciaIds` as CIAs permitidas para o usuario.
- Modulos como documento fiscal e vendas usam esse escopo para filtrar ou bloquear acesso.

API key:

- O webhook Accountfy usa `ensureApiKey`, separado do JWT.

## Rotas HTTP por Modulo

As rotas sao montadas em `src/routes/index.ts`.

### Auth - `/auth`

- `POST /auth`: login.
- `POST /auth/forgot-password`: gera fluxo de recuperacao.
- `GET /auth/validate-reset-token`: valida token de reset.
- `POST /auth/reset-password`: redefine senha.

### Usuarios - `/user`

- `GET /user/me`: dados do usuario autenticado.
- `PUT /user`: atualizacao de perfil proprio.
- `POST /user/avatar`: upload de avatar.
- `DELETE /user/avatar`: remove avatar.
- `GET/POST /user/admin`: lista/cria usuarios, apenas admin.
- `GET/PUT/DELETE /user/admin/:id`: consulta, atualiza e remove usuario, apenas admin.
- `POST /user/admin/:id/reenviar-email`: reenvia email de boas-vindas.

### CIAs - `/cia`

- CRUD administrativo de CIAs.
- `GET /cia/list-user-access`: lista CIAs que o usuario autenticado pode acessar.

### Grupos de Usuario - `/grupo-usuario`

- CRUD de grupos de usuario por CIA.
- `GET /grupo-usuario/:id/usuarios`: lista usuarios do grupo.
- `POST /grupo-usuario/:id/usuarios/:usuarioId`: adiciona usuario ao grupo.
- `DELETE /grupo-usuario/:id/usuarios/:usuarioId`: remove usuario do grupo.

Grupos tambem possuem periodo contabil (`dataInicio`, `dataFim`) usado no upload de romaneio.

### Configuracao Contabil - `/configuracao-contabil`

Modulo administrativo que parametriza como documentos e vendas viram payload SAP.

- CRUD da configuracao cabecalho.
- CRUD de detalhes: contas credito/debito, centro de custo/lucro e regras por tipo de processo.
- CRUD de pontos da configuracao: regras adicionais para documentos fiscais por pontos.

Tipos de processo usados:

- `TP_ROM`: troca de pontos via romaneio.
- `TP_POS`: troca de pontos via POS.
- `DR`: venda de pontos.
- `PD`: Promo Dotz.
- `RD`: receitas diferidas.
- `XTPG_R`: retorno XTPG para LCM.
- `VEX`: Vexpenses.

### Contas Contabeis - `/contas-contabeis`

- CRUD por chave composta `chartOfAccounts/companyCode/glAccount`.
- Importacao XLSX em `POST /contas-contabeis/import`.
- Exportacao em `GET /contas-contabeis/export`.
- Template de importacao em `GET /contas-contabeis/import-template`.

Tambem alimenta de-para XTPG, incluindo conta B1/XTPG para conta S/4.

### Contas Bancarias - `/contas-bancarias`

- CRUD por chave composta `codigoCia/houseBank/houseBankAccount`.
- Usado principalmente no de-para bancario para integracoes XTPG Saida.

### Documento Fiscal - `/documento-fiscal`

Funcionalidades gerais:

- `GET /documento-fiscal`: lista documentos.
- `GET /documento-fiscal/:id`: exibe header.
- `GET /documento-fiscal/:id/detalhes`: lista detalhes.
- `GET /documento-fiscal/:headerId/detalhes/:detalheId`: exibe detalhe.
- `GET /documento-fiscal/:id/divergencias`: lista erros/divergencias.
- `GET /documento-fiscal/:id/relatorio`: gera/retorna relatorio.
- `GET /documento-fiscal/:id/download`: baixa arquivo.
- `POST /documento-fiscal/:id/gerar-json-integracao`: monta JSON SAP para validacao.
- `POST /documento-fiscal/:id/aprovar`: aprova documento.
- `DELETE /documento-fiscal/:id`: remove romaneio, apenas admin.

Romaneio:

- `POST /documento-fiscal/upload-romaneio`: recebe XLSX, cria um header por `NFVENDA` e enfileira processamento dos detalhes.
- `POST /documento-fiscal/:id/revalidar`: reprocessa documento com a planilha existente ou uma nova planilha enviada.

POS:

- `GET /documento-fiscal/pos/segmentos`: grupos/segmentos.
- `GET /documento-fiscal/pos/list-filter-analyzer`: filtros vindos do Analyzer.
- `GET /documento-fiscal/pos/export/count`: quantidade para exportacao.
- `GET /documento-fiscal/pos/export`: exportacao.
- `POST /documento-fiscal/pos/create`: cria documento POS e enfileira processamento.
- `POST /documento-fiscal/:id/reprocessar-pos`: reprocessa POS.

Status de documento fiscal:

- `AGUARDANDO`
- `PROCESSANDO`
- `ERRO_PROCESSAMENTO`
- `APROVADO`
- `REPROVADO`
- `DIVERGENCIA`
- `INTEGRADO`
- `ERRO_INTEG`
- `RETORNO_INTEG`
- `ERRO_RETORNO_INTEG`
- `ENVIAR_EMAIL`
- `ERRO_ENVIAR_EMAIL`
- `PROCESSADO`
- `CANCELADO`

### Vendas - `/vendas`

- CRUD de headers de venda com anexos `arquivoFaturaDetalhada` e `arquivoRelatorioAnalitico`.
- CRUD de detalhes de venda.
- `POST /vendas/:id/processar`: muda venda de `CADASTRO` para `PENDENTE`.
- `POST /vendas/:id/reprocessar`: reenfileira/processa novamente conforme regra do modulo.
- `POST /vendas/reprocessar-lote`: reprocessamento em lote.
- `POST /vendas/:id/gerar-json-integracao`: monta payload SAP e gera relatorios para validacao.
- `POST /vendas/:id/consultar-boleto`: consulta boleto BankPlus.
- `POST /vendas/:id/reenviar-email`: reenvia email de venda.
- `GET /vendas/:id/download/:tipo`: baixa anexos/relatorios.
- `GET /vendas/:id/diferidas`: lista receitas diferidas geradas.
- `GET /vendas/:id/diferidas/:difeididaId`: exibe uma diferida.
- `POST /vendas/:id/diferidas/:difeididaId/reprocessar`: reprocessa integracao da diferida.
- `POST /vendas/:id/diferidas/:difeididaId/reverter`: solicita reversao.

Status de vendas:

- `CADASTRO`
- `PENDENTE`
- `AGUARDANDO`
- `PROCESSANDO`
- `ERRO_PROC`
- `ERRO_FATURA`
- `INTEG_SAP`
- `ERRO_INTEG_SAP`
- `AGUARDANDO_BOLETO`
- `ERRO_BOLETO`
- `ENVIANDO_EMAIL`
- `ERRO_EMAIL`
- `CONCLUIDO`
- `CANCELADO`

Receita diferida:

- Gerada apos integracao SAP da venda, quando existe configuracao `DR` com periodo/taxa e configuracao `RD`.
- Cria parcelas `DIFERIDO_TOTAL` e `DIFERIDO_VENDA`.
- A ultima parcela absorve diferencas de arredondamento.
- Estados validos: `PENDENTE`, `INTEGRADO`, `ERRO_INTEG`, `REVERSAO_PENDENTE`, `REVERTIDO`, `ERRO_REVERT`.

### Relatorios - `/relatorio`

Modulo de relatorios dinamicos sobre banco read-only.

- CRUD administrativo de relatorios.
- `GET /relatorio/schema/databases`: introspeccao de schema permitida para admin.
- `POST /relatorio/:id/executar`: executa query com variaveis, filtros, ordenacao e paginacao.
- `POST /relatorio/:id/exportar`: exporta resultado.

Regras de seguranca:

- Query deve comecar com `SELECT`.
- Multiplas instrucoes com `;` sao bloqueadas.
- Operacoes como `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `EXECUTE`, `XP_` e `SP_` sao bloqueadas.
- Referencias de tabela devem usar nome completo `banco.schema.tabela`.
- Bancos permitidos sao controlados por `RELATORIO_ALLOWED_DATABASES`.
- Execucao tem timeout de 30 segundos.

### Fluxo de Caixa XTPG - `/fluxo-caixa-xtpg`

Modulo administrativo para classificacao e de-para do fluxo XTPG.

- Lista fornecedores OCRD do stage.
- Gerencia vinculos CIA/parceiro.
- Gerencia tipos de lancamento por CIA.
- `POST /fluxo-caixa-xtpg/classificar-lote`: roda classificacao de lote de registros contabeis.

### XTPG Envios - `/xtpg-envios`

Consulta e reprocessamento de lotes enviados ao DeepXRT.

- `GET /xtpg-envios/:fluxo/headers`: lista headers de `previsto` ou `realizado`.
- `GET /xtpg-envios/:fluxo/headers/:id`: exibe header e detalhes.
- `POST /xtpg-envios/:fluxo/reprocessar`: reprocessa lote.

### Registros Contabeis - `/registros-contabeis`

- Lista registros contabeis sincronizados.
- Lista itens de fluxo de caixa.
- Atualiza item de fluxo de caixa por chave `companyCode/fiscalYear/accountingDocument/accountingDocumentItem`.

### Controle Expense - `/controle-expense`

- Lista e exibe despesas importadas do Vexpenses.
- Reprocessa uma despesa ou lote.
- Guarda request/response SAP, status, erro e codigo ERP quando integrado.

### Integracoes - `/integracoes`

- `GET /integracoes`: lista jobs registrados, agenda, se tem disparo manual e ultima execucao.
- `POST /integracoes/:key/run`: dispara integracao manual quando o job permite.

As execucoes sao registradas em `IntegrationExecutionLog`.

### Webhooks Accountfy - `/webhooks/accountfy`

- `GET /webhooks/accountfy/registros-contabeis`: sincroniza registros contabeis via webhook protegido por API key.

### Arquivos Publicos - `/files`

- `GET /files/:filename`: download publico controlado pelo service.

Rotas estaticas tambem expõem `uploads`, `uploads/avatars`, `uploads/planilhas`, `relatorios` e `assets`.

## Fluxos de Negocio Principais

### Upload e Processamento de Romaneio

1. Usuario envia XLSX em `/documento-fiscal/upload-romaneio`.
2. Service valida CIA ativa, configuracao contabil, periodo contabil do grupo do usuario e datas.
3. XLSX e lido; a coluna `NFVENDA` separa documentos.
4. Documentos ja cadastrados/integrados sao barrados.
5. O arquivo e armazenado.
6. Um `DocumentoFiscalHeader` e criado por codigo de documento.
7. Uma mensagem por documento e publicada em `documento-fiscal.queue`.
8. Worker le a planilha, filtra linhas do documento, busca pedidos no Analyzer/stage, valida duplicidades, itens, pedido e totais.
9. Divergencias sao persistidas, mas nao interrompem a analise das demais linhas.
10. Status final vira `APROVADO` ou `DIVERGENCIA`; se aprovado, o documento e enfileirado para integracao SAP.

### Documento POS

1. API cria um documento POS com filtros/segmentos vindos do Analyzer.
2. Worker `PROCESSAR_DETALHES_POS` busca dados no stage por filtros.
3. O processamento gera detalhes, valida duplicidades e aplica configuracao contabil.
4. Se aprovado, segue para integracao SAP.

### Integracao SAP de Documento Fiscal

1. `IntegrationOrchestratorService` valida se o documento pode integrar.
2. Publica mensagem em `sap-integration.queue` ou executa diretamente conforme chamada.
3. Worker monta payload, chama servico SAP de Journal Entry e atualiza status.
4. Em erro tecnico, tenta retry; ao esgotar, manda para DLQ e marca `ERRO_INTEG`.
5. Erros de negocio (`AppError`) sao descartados sem retry.

### Vendas e Receita Diferida

1. Venda nasce em `CADASTRO`.
2. `/vendas/:id/processar` muda para `PENDENTE`.
3. Cron ou reprocessamento enfileira/processa vendas pendentes.
4. Worker integra venda com SAP.
5. Ao integrar, salva `codigoDocumentoERP`, `dataVencimento` e gera relatorios.
6. Consulta no stage se forma de pagamento do cliente e boleto.
7. Se boleto, status vai para `AGUARDANDO_BOLETO`; caso contrario, `ENVIANDO_EMAIL`.
8. Gera parcelas de receita diferida se houver configuracoes `DR` e `RD`.
9. Parcelas diferidas sao integradas e podem ser revertidas via fila propria.

### Vexpenses

1. Cron busca relatorios aprovados no Vexpenses.
2. Dados sao normalizados e persistidos em `ControleExpense`.
3. Payloads SAP sao publicados em `vexpenses-integration.queue`.
4. Worker envia ao SAP e atualiza `ControleExpense` para `INTEGRADO_SAP` ou `ERRO_INTEGRACAO_SAP`.
5. Outro cron consulta pagamentos por clearing para atualizar registros relacionados.

### XTPG Envio

O modulo envia movimentos para DeepXRT:

- Previsto: view `XRT_SendPrevPagto`.
- Realizado/fluxo: view `XRT_SendFlux`.

Fluxo:

1. Cron le views configuradas.
2. Monta movimentos SOAP em lotes.
3. Antes do POST marca registros como `status_para_envio = 'P'` para evitar reenvio em caso de crash.
4. Envia SOAP.
5. Sucesso marca `S` e salva `id_xrt`; erro de negocio marca `E`.
6. Logs sao gravados em headers/details de XTPG.

### XTPG Saida

O modulo le movimentos contabeis pendentes no DeepXRT, agrupa por `PAR_CONTABIL`, monta LCM/Journal Entry para SAP e devolve status ao XTPG.

Pontos importantes:

- O envio efetivo ao SAP fica protegido por `XTPG_SAIDA_ENVIO_SAP_HABILITADO`.
- Por padrao, o gate e `false`.
- Usa de-para de CIA, contas bancarias e contas contabeis.
- Se faltar de-para ou configuracao `XTPG_R`, trava o grupo inteiro.
- Anti-duplicidade por `chave_validacao = cia_sap + parcontabil`.

### Registros Contabeis e Classificacao

- `SyncRegistrosContabeisService` sincroniza itens contabeis do SAP/API externa para `AccountingDocumentItem`.
- A classificacao de fluxo XTPG deduz `itemFluxoCaixa` com base em regras de parceiro/tipo de lancamento.
- Itens podem ser ajustados via API admin.

## Jobs Cron

Os jobs sao registrados em `src/cron/jobs/index.ts` e executados pelo `CronManager`.

Jobs atuais:

- `syncSapPartnersJob`: sincroniza parceiros SAP.
- `syncRegistrosContabeisJob`: sincroniza registros contabeis.
- `vexpensesApprovedReportsJob`: importa relatorios aprovados do Vexpenses.
- `vexpensesPaymentByClearingJob`: consulta pagamentos Vexpenses por clearing.
- `processVendasPendentesJob`: processa vendas pendentes.
- `processVendasIntegracaoAnalyzerJob`: processa integracao/analyzer de vendas.
- `consultarBoletoJob`: consulta boletos.
- `enviarVendasEmailJob`: envia emails de vendas.
- `processVendaRecDiferidaPendentesJob`: integra parcelas diferidas pendentes.
- `processVendaRecDiferidaReversaoJob`: reverte parcelas diferidas pendentes.
- `detectVendaRecDiferidaReversaoSapJob`: detecta reversao SAP de diferidas.
- `detectTrocaReversaoSapJob`: detecta cancelamento/reversao de troca no SAP.
- `classificacaoFluxoCaixaXtpgJob`: classifica fluxo de caixa XTPG.
- `xtpgEnviarPrevistoJob`: envia previsto XTPG.
- `xtpgEnviarRealizadoJob`: envia realizado XTPG.
- `xtpgProcessarSaidaJob`: processa saida XTPG.

Caracteristicas do `CronManager`:

- Calcula proxima execucao com timezone do Brasil.
- Impede sobreposicao do mesmo job.
- Permite disparo manual quando `manualTrigger = true`.
- Registra inicio/fim/erro em `IntegrationExecutionLog`.

## Filas RabbitMQ

Filas principais:

- `email.queue`
- `documento-fiscal.queue`
- `sap-integration.queue`
- `vexpenses-integration.queue`
- `vendas-integration.queue`
- `venda-rec-diferida-integration.queue`
- `venda-rec-diferida-reversao.queue`

Cada fila possui DLQ correspondente. Consumers usam `ack`, `nack`, retry via header `x-retry-count` e envio para DLQ quando as tentativas acabam.

Regras gerais:

- Erros de negocio (`AppError`) normalmente nao sao retentados.
- Erros tecnicos sao retentados.
- Prefetch e configuravel por variavel de ambiente.
- Workers sobem com `npm run dev:workers` ou `npm run start:workers`.

## Integracoes Externas

- SAP S/4HANA: autenticacao/token e criacao de Journal Entries.
- Analyzer/stage: leitura de pedidos, parceiros, itens, faturamentos e forma de pagamento.
- Vexpenses: importacao de relatorios aprovados e consulta de pagamentos.
- DeepXRT/XTPG: SOAP de entrada (`SendPrev`, `SendFlux`) e saida (`LCM`).
- BankPlus Invent: consulta de boletos.
- Email SMTP: boas-vindas, recuperacao de senha, relatorios de fornecedor/vendas.
- Storage: uploads, relatorios, anexos, avatares e arquivos publicos.

## Variaveis de Ambiente Relevantes

Categorias principais em `src/config/config.ts`:

- API: `PORT`, `APP_URL`, `API_URL`, `CORS_ORIGIN`, `APP_API_KEY`.
- Auth: `ACCESS_TOKEN_SECRET`, `ACCESS_TOKEN_EXPIRATION`, `ENCRYPTION_KEY`.
- Banco: `DATABASE_CONNECTION_LIMIT`, `DATABASE_POOL_TIMEOUT`, URLs dos schemas Prisma.
- RabbitMQ: `RABBITMQ_URL`, `RABBITMQ_PREFETCH*`.
- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`.
- Storage: `BASE_STORAGE_FOLDER`, `GCS_*`.
- SAP S/4HANA: `S4_HANA_CLOUD_*`.
- Relatorios: `RELATORIO_READONLY_DATABASE_URL`, `RELATORIO_ALLOWED_DATABASES`.
- Vexpenses: `VEXPENSES_*`, `CRON_VEXPENSES_*`.
- XTPG Entrada/Saida: `XTPG_*`, `CRON_XTPG_*`.
- BankPlus: `BANKPLUS_INVENT_*`.
- Observabilidade: `ELASTICSEARCH_*`, `ELASTIC_APM_*`.

## Padroes de Implementacao

- Controllers devem apenas ler request, chamar service e responder.
- Services concentram regra de negocio e normalmente expõem `execute()`.
- Validacoes de negocio usam `AppError` para status HTTP controlado.
- Datas devem usar helpers de `src/util/date.ts`.
- Para datas de negocio sem hora, usar `formatDateOnly()`.
- Para timestamp em timezone brasileiro, usar `formatDateToBrazilianTimezone()`.
- Evitar N+1 com Prisma usando `include`/`select`.
- Processamentos pesados devem ir para fila ou cron, nao ficar presos no request HTTP.
- Rotas admin usam `ensureAuthenticate` + `permissionsRequired(Perfil.ADMIN)`.
- Rotas por CIA usam `ensureCiaAccess` e validacoes de escopo nos services.

## Pontos de Atencao para Manutencao

- A API inicia cron jobs junto com `npm run dev`/`npm start`; workers RabbitMQ sao outro processo.
- Sem `npm run prisma:generate`, os clients customizados podem falhar ao iniciar.
- `dotz-stage` e `relatorio-readonly` dependem de variaveis de ambiente especificas.
- XTPG Saida tem gate de seguranca desligado por padrao.
- Relatorios dinamicos usam `$queryRawUnsafe`, mas passam por validadores de SELECT, tabelas permitidas, parametros, filtros e timeout.
- Erros de fila podem ficar em DLQ; investigar DLQs e logs antes de reenfileirar manualmente.
- Status sao parte da regra de negocio. Antes de alterar uma transicao, procurar por usos em services, consumers e jobs.
- Migrations e SQL manual coexistem em `prisma/s4_extensao_dotz`; confirmar ambiente antes de aplicar alteracoes.

## Onde Comecar ao Mexer em Cada Area

- Nova rota HTTP: `src/modules/<modulo>/routes`, controller e service correspondente.
- Regra de documento fiscal: `src/modules/documento-fiscal`.
- Regra de vendas ou diferidas: `src/modules/vendas`.
- Integracao SAP de documentos: `src/modules/documento-fiscal/utils/integracao`.
- Integracao SAP de vendas: `src/modules/vendas/utils/integracao`.
- Jobs: `src/cron/jobs` e services em `src/cron/modules`.
- Filas: `src/queue/producers`, `src/queue/consumers` e `src/queue/types`.
- Banco/modelagem: schemas em `prisma/*/schema.prisma`.
- Configuracao: `src/config/config.ts`.
- Testes: `tests/unit` e `tests/integration`.
