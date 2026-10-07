# XTPG Saída – LCM no S/4 (DTZ-227)

Lê os movimentos contábeis pendentes no XTPG (DeepXRT `Saida.asmx`), agrupa por
**PAR_CONTABIL**, cria o lançamento contábil (LCM / Journal Entry) no **S/4** e
devolve o status ao XTPG. Migração do legado `XrtServImporterConsole` (SAP B1).

> Especificação completa: `E:\Devs\ActionSys\_DOTZ\ESPECS\DTZ-227_Saida_XTPG_LCM_S4.md`

## Estrutura

```
xtpg-saida/
├── types/xtpgSaida.types.ts                       # contrato dos movimentos + tipos internos
├── soap/buildSaidaSoapEnvelope.ts                 # envelopes Listar / MudarStatus
├── soap/XtpgSaidaSoapClient.ts                    # cliente SOAP (sem auth)
├── repositories/
│   ├── CiaDeParaRepository.ts                     # PFJ_CODIGO -> CompanyCode (tabela cia)
│   ├── ConfiguracaoContabilXtpgRepository.ts      # tipoArApGl/tipoDocumento/textoDocumento (XTPG_R)
│   ├── ContasBancariasDeParaRepository.ts         # de-para House Bank (2 modos)
│   └── ContasContabeisDeParaRepository.ts         # de-para conta B1 (XTPG) -> conta S/4
├── mappers/buildLcmFromMovimentos.ts              # monta o IntegracaoSAPJson do LCM
└── services/ProcessarSaidaXtpgService.ts          # orquestra fila SAP -> fila XTPG
```

Cron: `src/cron/jobs/xtpgProcessarSaidaJob.ts` (registrado em `src/cron/jobs/index.ts`).
Tabelas de log: `xtpg_saida_header` / `xtpg_saida_detail` (models no schema Prisma;
SQL idempotente em `prisma/s4_extensao_dotz/manual_sql/xtpg_saida_log_tables.sql`).

## Fluxo e matriz de reprocessamento

1. `ListarMovimentosContabeisPeloStatus(status)` → movimentos pendentes.
2. Agrupa por PAR_CONTABIL (1 LCM por grupo).
3. **Fila SAP**: `createJournalEntry` → `status_sap`, `codigo_sap`.
4. **Fila XTPG**: `MudarStatusMovimentoParContabil` (critica = `codigo_sap`) → `status_xtpg`.

Gate = `status_sap`:

| status_sap | status_xtpg | ação |
|------------|-------------|------|
| ERRO | ERRO | reprocessa SAP (recria o LCM) |
| INTEGRADO | ERRO | só fila XTPG (nunca recria o LCM) |
| INTEGRADO | INTEGRADO | concluído |

Anti-duplicidade: `chave_validacao = cia_sap + parcontabil`.

## ⚠️ Estado: ESQUELETO (pendências abertas)

O envio efetivo ao S/4 está **desabilitado por padrão** via
`XTPG_SAIDA_ENVIO_SAP_HABILITADO=false`. O LCM é montado e gravado em `request_sap`,
mas **não é enviado** enquanto houver pendências de regra:

- **Contrato `createJournalEntry`** – `HouseBank`/`HouseBankAccount`/`TextoDetalhe` por
  linha ficam **comentados** no mapper (definição da equipe, 11/06) – o contrato ainda
  não será estendido. O de-para bancário é resolvido e gravado no Detail (rastreio).

Definidos:
- **De-para empresa** – correlação direta `PfjCodigo` == `nome_base_dados_b1` (confirmada).
- **De-para conta bancária** – ordem dos 2 modos indiferente; **sem correspondência em
  qualquer movimento => trava o PAR_CONTABIL inteiro** (Header `status_sap=ERRO` com a
  lista dos movimentos sem de-para em `descricao_sap`).
- **De-para conta contábil B1 → S/4** – campo `gl_account_b1_xtpg` em `contas_contabeis`;
  sem correspondência trava o PAR_CONTABIL (mesmo tratamento do de-para bancário).
- **Tipo de documento / tipoArApGl / textoDocumento** – vêm da `configuracao_contabil_header`
  (tipoProcesso=`XTPG_R`) via `ConfiguracaoContabilXtpgRepository`; sem configuração cadastrada
  trava o PAR_CONTABIL.
- **Centro de custo** – **não enviado**; o campo `centroCusto` é opcional no contrato `createJournalEntry` e o XTPG Saída não o preenche (lançamentos GL puros).

Procurar por `TODO(DTZ-227)` no código para os pontos exatos.

## Variáveis de ambiente

```
XTPG_SAIDA_API_BASE_URL=https://apih.deepxrtbr.com.br   # (default = entrada)
XTPG_SAIDA_API_ENDPOINT=/dotz/SOAP_API/ITF/Saida.asmx
XTPG_SAIDA_STATUS_BUSCA=I            # status consultado (legado B1)
XTPG_SAIDA_STATUS_SUCESSO=C          # devolvido ao XTPG no sucesso
XTPG_SAIDA_STATUS_ERRO=E
CRON_XTPG_SAIDA=0 */4 * * *
CRON_XTPG_SAIDA_ENABLED=false
XTPG_SAIDA_ENVIO_SAP_HABILITADO=false   # gate de segurança (manter false até fechar pendências)
```
