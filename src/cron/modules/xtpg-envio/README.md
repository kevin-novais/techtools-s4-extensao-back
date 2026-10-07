# Módulo XTPG Envio (DeepXRT) — SendPrev / SendFlux

Porta para TypeScript da integração de **envio** XTPG do legado C#
(`XrtServImporterConsole` / `XRT.DATA.Send_Previsto` e `Send_Realizado`).

## Escopo

- ✅ **SendPrev** — envio previsto (view `XRT_SendPrevPagto`, em `s4_extensao_dotz`)
- ✅ **SendFlux** — envio realizado/fluxo (view `XRT_SendFlux`, em `s4_extensao_dotz`)
- ⏸️ **saida.asmx / LCM** (ler movimentos de volta, mudar status do lote, write-back
  do `U_XRTId` no SAP) — **fora deste escopo**, fica para uma etapa futura. Os campos
  de origem (`origem_tabela`, `origem_doc_entry`) já são gravados nos logs para
  viabilizar esse write-back depois.

## Arquitetura

```
xtpg-envio/
├── config/xtpgFieldMap.ts     # mapa campo Movimento -> coluna da view + transform (por fluxo)
├── types/xtpgEnvio.types.ts    # MovimentoXtpg (aliases xmlns deep:) + tipos de resultado
├── mappers/buildMovimentoXtpg.ts  # linha da view -> Movimento + origem (aplica transforms)
├── soap/buildSoapEnvelope.ts   # template do envelope SOAP em LOTE (escape XML)
├── soap/XtpgSoapClient.ts      # POST text/xml + parse tolerante de ID/MensagemErro
├── repositories/XtpgViewRepository.ts  # SELECT raw nas views (datasource/nome configuráveis)
└── services/
    ├── EnviarXtpgBaseService.ts     # orquestração (lê -> mapeia -> lote -> log -> envia -> atualiza)
    ├── EnviarPrevistoXtpgService.ts # injeta config do fluxo previsto
    └── EnviarRealizadoXtpgService.ts# injeta config do fluxo realizado
```

Jobs: `src/cron/jobs/xtpgEnviarPrevistoJob.ts` e `xtpgEnviarRealizadoJob.ts`
(registrados em `src/cron/jobs/index.ts`).

Tabelas de log: `xtpg_envio_previsto_header/_detail` e
`xtpg_envio_realizado_header/_detail` (schema + migration em
`prisma/s4_extensao_dotz/`).

- **HEADER** = 1 requisição (lote): `request` (payload SOAP completo), `response`
  (retorno bruto), `status` (PROCESSANDO/ENVIADO/PARCIAL/ERRO), `total_registros`.
- **DETAIL** = 1 movimento por linha, **denormalizado** (espelho de todos os campos
  enviados) + `status` individual + `id_xrt` / `mensagem_erro` retornados por registro.

## Manutenção do mapeamento

Para alterar de qual coluna da view um campo do Movimento é lido, edite apenas
`config/xtpgFieldMap.ts` (`XTPG_FIELD_MAP_PREVISTO` / `XTPG_FIELD_MAP_REALIZADO`).
Os nomes das colunas são exatamente os retornados pelas views.

## Configuração (.env)

| Variável | Descrição |
|---|---|
| `XTPG_API_BASE_URL` | homolog `https://apih.deepxrtbr.com.br` / prod `https://apic...` |
| `XTPG_API_ENDPOINT` | `/dotz/SOAP_API/ITF/Entrada.asmx` |
| `XTPG_API_USUARIO` / `XTPG_API_SENHA` | credenciais do `ValidationSoapHeader` |
| `XTPG_VIEW_DATASOURCE` | `stage` (Dotz_Stage_Trocas) ou `s4` (s4_extensao_dotz) |
| `XTPG_VIEW_PREVISTO` / `XTPG_VIEW_REALIZADO` | nomes das views |
| `CRON_XTPG_SEND_PREV(_ENABLED)` | agendamento / liga-desliga do previsto |
| `CRON_XTPG_SEND_FLUX(_ENABLED)` | agendamento / liga-desliga do realizado |
| `XTPG_SEND_PREV_BATCH_SIZE` / `XTPG_SEND_FLUX_BATCH_SIZE` | movimentos por requisição (lote) |
| `XTPG_SEND_*_MAX_PER_RUN` | teto de leitura da view por execução (0 = sem limite) |

## Como aplicar / rodar

```bash
# 1. gerar o Prisma client (inclui as novas tabelas de log) — não precisa de DB
npm run prisma:generate:s4

# 2. aplicar a migration (com o SQL no ar)
npm run prisma:migrate:deploy:s4

# 3. subir a API (os crons sobem juntos quando *_ENABLED=true)
npm run dev
```

## Anti-duplicidade / write-back

As views já filtram por `registros_contabeis.status_para_envio is null`. Por isso, após
cada movimento, o serviço faz **write-back** em `registros_contabeis` (PK composta
`Company-fiscal-doc-item`, vinda de `DocEntry`/`CHAVE`):
- **sucesso** → `status_para_envio = 'S'` + `id_xrt = <retorno>`
- **erro** → `status_para_envio = 'E'`

Assim a view para de retornar o registro no próximo cron. (A política de reprocessamento
de erros fica a cargo da view; o serviço apenas integra + loga + marca o status.)

### Idempotência (janela de falha)

Para um crash entre o POST e a finalização não causar reenvio:
- antes do POST, os registros do lote são marcados **`status_para_envio='P'`** (processando).
  Como a view só retorna `status_para_envio is null`, um `'P'` já **não é re-selecionado**.
- após a resposta: `'S'`+`id_xrt` (sucesso) ou `'E'` (rejeitado pela XTPG).
- em **falha de transporte do lote** (resposta desconhecida), os registros **permanecem `'P'`**
  (não reenvia automaticamente; revisão/decisão fica para a view, evitando duplo-envio).
- um **guard de reentrância** por fluxo impede que dois disparos do mesmo cron se sobreponham.

Registros presos em `'P'` (ex.: crash real) ficam visíveis (HEADER em `PROCESSANDO`) e só
voltam a ser enviados se o `status_para_envio` for redefinido para nulo (manual/via view).

## Validação (contra SQL real)

Mapeamento e payload conferidos contra as views reais e o decompilado `WebMethods.cs`:
- `DocPagador` = data atual `yyyyMMdd` (constante).
- Previsto: `ContaContabil`/`InformacoesContabeis` = `AcctCode`; `OrigemPk` = `DocEntry`;
  `OrigemSistema` = `ObjType`; `Temperatura` = 1; envia `Historico` (comments).
- Realizado: `ContaContabil` = `Conta_contabil` (código da conta de origem, DTZ-284);
  `InformacoesContabeis` = `Conta_contrapartida` (contrapartida, DTZ-284);
  `OrigemPk` = `Nr_Doc_SAP`; `OrigemSistema` = `Diario_original2` (conteúdo cru; a view já retorna AR/AP/GL);
  `Temperatura` = coluna; **não** envia `Historico`.

## Endpoints (confirmados pelo suporte XTPG)

| Ambiente | Entrada (EnviarListaMovimentoCaixaAssinc) | Saída (LCM) |
|---|---|---|
| Homologação | `https://apih.deepxrtbr.com.br/dotz/SOAP_API/ITF/Entrada.asmx` | `.../dotz/SOAP_API/ITF/saida.asmx` |
| Produção | `https://apic.deepxrtbr.com.br/dotz/soap_api/itf/entrada.asmx` | `.../dotz/soap_api/itf/saida.asmx` |

> **Sem autenticação** em homolog e produção — `XTPG_API_USUARIO`/`XTPG_API_SENHA` ficam vazios
> (o `ValidationSoapHeader` é enviado com valores vazios).
> **Atenção:** em produção o path é **minúsculo** (`soap_api/itf/entrada.asmx`); ao migrar,
> ajustar `XTPG_API_BASE_URL` **e** `XTPG_API_ENDPOINT`.

## Resposta do XTPG (validado em homologação)

Testado com 1 e 2 movimentos contra homolog (sem auth). A resposta traz um bloco por
movimento, ecoando `OrigemPk`:
```xml
<EnviarListaMovimentoCaixaAssincResult>
  <MovimentoRecebido>
    <OrigemSistema>AP</OrigemSistema>
    <OrigemPk>1410-2026-5100000104-1</OrigemPk>
    <ID>fb0667e7-b523-4ad3-bf3b-b3c7bc6dac17</ID>
    <MensagemErro />
  </MovimentoRecebido>
  ...
</EnviarListaMovimentoCaixaAssincResult>
```
- `ID` = UUID do movimento (sucesso). `ID = 00000000-0000-0000-0000-000000000000` = rejeição.
- `MensagemErro` vem auto-fechada (`<MensagemErro />`) quando não há erro.
- O `XtpgSoapClient` casa cada resultado ao movimento enviado **por `OrigemPk`** (fallback posicional).

## Pendências

1. **saida.asmx / LCM** (ler movimentos de volta + reconciliar registros em `'P'`) segue fora de escopo.
2. Teste fim-a-fim **dentro da VM** (cron real lendo a view + gravando log + write-back) — depende
   do deploy da versão atualizada no ambiente (o container de staging roda build anterior).
```
