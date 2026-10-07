# Tests — Setup e Estrutura

Esta pasta contém os arquivos de bootstrap dos testes. Para entender como o sistema funciona, leia esse documento antes de adicionar novos testes ou modificar a infra.

---

## Sumário

- [Visão geral](#visão-geral)
- [Tipos de teste](#tipos-de-teste)
- [Como rodar](#como-rodar)
- [Banco de testes isolado (Docker)](#banco-de-testes-isolado-docker)
- [Setup files explicados](#setup-files-explicados)
- [Mocks de APIs externas (MSW)](#mocks-de-apis-externas-msw)
- [Mocks de RabbitMQ e e-mail](#mocks-de-rabbitmq-e-e-mail)
- [Helpers e factories](#helpers-e-factories)
- [Cleanup entre testes](#cleanup-entre-testes)
- [Como escrever um novo teste de integração](#como-escrever-um-novo-teste-de-integração)
- [Vitest UI](#vitest-ui)
- [Coverage](#coverage)
- [Atualizar fixtures contra APIs reais](#atualizar-fixtures-contra-apis-reais)
- [Troubleshooting](#troubleshooting)

---

## Visão geral

| Tipo | Onde | Banco | Rede |
|---|---|---|---|
| **Unit** | [tests/unit/](../unit/) | Prisma 100% mockado (`vi.mock`) | Sem chamadas reais |
| **Integration** | [tests/integration/](../integration/) | SQL Server local em Docker isolado (porta 1434) | APIs externas mockadas via MSW; supertest bate no Express real |

**Princípio de design:** integração testa fluxos end-to-end (HTTP → Service → Prisma → DB) com APIs externas determinísticas (MSW). Nada bate em internet por padrão.

---

## Tipos de teste

**Unit** — `tests/unit/**/*.unit.test.ts`
- Foco: lógica de service (validação, branching, formatação).
- Prisma e dependências externas mockadas com `vi.mock`.
- Setup global: [vitest.setup.ts](vitest.setup.ts) — silencia logger Winston e carrega `.env`.
- Config: [vitest.config.ts](../../vitest.config.ts).

**Integration** — `tests/integration/**/*.integration.test.ts`
- Foco: fluxos HTTP completos com Prisma + DB real.
- Banco SQL Server isolado (Docker, porta 1434) com migrations aplicadas.
- APIs externas (SAP, Vexpenses, BankPlus) interceptadas pelo MSW com fixtures.
- RabbitMQ e nodemailer mockados via `vi.mock`.
- Express app montado via `createApp()` em [src/app.ts](../../src/app.ts) e exercitado por [supertest](https://github.com/ladjs/supertest).
- Setup global: [integration.global-setup.ts](integration.global-setup.ts) + [integration.setup.ts](integration.setup.ts).
- Config: [vitest.integration.config.ts](../../vitest.integration.config.ts).

---

## Como rodar

```bash
# 1. Subir banco de testes (uma vez por sessão; container persiste)
npm run db:test:up

# 2. Aplicar migrations (idempotente)
npm run db:test:migrate

# 3. Rodar testes
npm run test                    # unit
npm run test:integration        # integration

# Modos extras
npm run test:watch              # unit em watch
npm run test:integration:watch  # integration em watch
npm run test:ui                 # unit com Vitest UI
npm run test:integration:ui     # integration com Vitest UI

# Coverage
npm run test:coverage:unit         # coverage só unit       → coverage/unit/
npm run test:integration:coverage  # coverage só integração → coverage/integration/
npm run test:coverage:all          # roda ambos sequencialmente

# Encerrar / resetar banco de testes
npm run db:test:down            # para o container, mantém volume
npm run db:test:nuke            # para o container e apaga volume (reset total)
npm run db:test:reset           # roda prisma migrate reset (recria schema)
```

**Pré-requisitos:** Docker Desktop rodando, Node 22, Prisma client gerado (`npm run prisma:generate:s4`).

---

## Banco de testes isolado (Docker)

**Arquivo:** [docker-compose.test.yml](../../docker-compose.test.yml) (raiz do projeto).

- Imagem: `mcr.microsoft.com/mssql/server:2022-latest`
- Container: `s4_extensao_dotz_mssql_test`
- Porta host: **1434** (não conflita com SQL Server dev em 1433)
- Senha SA: `Test@StrongPwd2026!` (apenas teste — sem segredo real)
- Banco: `s4_extensao_dotz_test` (criado automaticamente no globalSetup)
- Volume: `mssql_test_data` (mantém dados entre runs; use `db:test:nuke` para reset)
- Healthcheck via `sqlcmd` para garantir prontidão antes de aceitar conexões.

**Conexão (lida do [.env.test](../../.env.test)):**
```
DATABASE_URL="sqlserver://localhost:1434;database=s4_extensao_dotz_test;user=sa;password=...;trustServerCertificate=true;encrypt=true"
```

---

## Setup files explicados

### [integration.global-setup.ts](integration.global-setup.ts)

Roda **uma vez** antes de toda a suite (vitest `globalSetup`):

1. **Garante que o banco existe** — conecta no `master` via driver `mssql`, executa `CREATE DATABASE IF NOT EXISTS`.
2. **Aplica migrations** — invoca `prisma migrate deploy` chamando o binário Node direto (cross-platform, sem `npx.cmd`).

### [integration.setup.ts](integration.setup.ts)

Roda **antes de cada test file** (vitest `setupFiles`):

- **Top-level (uma vez por processo):**
  - Inicia o `mswServer` MSW com `onUnhandledRequest` que ignora `localhost`/`127.0.0.1` (supertest).
  - Registra event listener `request:start` (logs com `MSW_DEBUG=true`).
  - Usa `globalThis.__MSW_STARTED__` como flag para evitar re-listen em re-execuções de módulo.
  - Importa [mocks/queue.ts](../integration/mocks/queue.ts) e [mocks/email.ts](../integration/mocks/email.ts) — esses arquivos chamam `vi.mock` no top-level (hoisted).

- **Por teste (`beforeEach`):**
  1. `truncateAll()` — limpa todas as tabelas (DELETE + DBCC RESEED + FK toggle).
  2. `seedSystemUser()` — insere o usuário sistema (id=1) que serve de `atualizadoPor` default nas factories.

- **Por teste (`afterEach`):** `mswServer.resetHandlers()` — remove handlers `server.use(...)` adicionados por testes específicos.

- **Por arquivo (`afterAll`):** `disconnect()` (fecha pool Prisma). **Não fecha** o MSW para mantê-lo ativo entre files.

### [vitest.setup.ts](vitest.setup.ts)

Setup global para **unit tests** apenas. Carrega `.env` e mocka o logger Winston globalmente.

---

## Mocks de APIs externas (MSW)

**Por que MSW?** Todos os clients HTTP do projeto usam `axios` direto. MSW v2 intercepta no nível do módulo `http`/`https` do Node, então pega `axios` sem precisar mockar `axios` ou cada client individualmente.

**Estrutura:**

```
tests/integration/mocks/
├── server.ts                        # setupServer(...allHandlers); flag isMswEnabled
├── handlers/
│   ├── index.ts                     # exporta allHandlers
│   ├── sap.handlers.ts              # OAuth + GL accounts + journal entries + business partners
│   ├── vexpenses.handlers.ts        # /reports, /report-expenses, /team-members, etc.
│   └── bankplus.handlers.ts         # /authenticate, /api/cobranca/pdfs
└── fixtures/
    └── sap-registros-contabeis.json   # captura real do GET /http/getJournalEntries
```

**Fixtures** são capturas reais de respostas das APIs externas, salvas em JSON estático. O MSW lê o arquivo no import e devolve no handler — request real nunca sai. Atualmente só `sap-registros-contabeis.json` está em uso ([sap.handlers.ts](../integration/mocks/handlers/sap.handlers.ts)). Quando expandir cobertura Vexpenses/BankPlus, adicione novos JSONs aqui e referencie nos handlers correspondentes — gere com `RUN_EXTERNAL_INTEGRATION_TESTS=true` (ver [Atualizar fixtures](#atualizar-fixtures-contra-apis-reais)).

**Override por teste** (handlers transitórios, removidos no `afterEach`):

```typescript
import { http, HttpResponse } from "msw";
import { mswServer } from "../mocks/server";

it("trata 500 do SAP", async () => {
    mswServer.use(
        http.get("http://fake-sap.invalid/http/getJournalEntries", () =>
            HttpResponse.json({ error: "boom" }, { status: 500 }),
        ),
    );

    // ... seu teste
});
```

---

## Mocks de RabbitMQ e e-mail

Esses não usam HTTP, então são mockados via `vi.mock` em arquivos no top-level (hoisted pela vitest).

- **[mocks/queue.ts](../integration/mocks/queue.ts)** — substitui `@/queue/config/rabbitmq` por um canal noop (`assertQueue`/`sendToQueue`/etc viram `vi.fn()`). Exporta `channelMock` para asserções.

- **[mocks/email.ts](../integration/mocks/email.ts)** — substitui `nodemailer.createTransport` por `{ sendMail: vi.fn() }`. Exporta `sendMailMock` para asserções:

  ```typescript
  import { sendMailMock } from "../mocks/email";

  it("dispara email no esqueci-senha", async () => {
      await testAgent().post("/auth/forgot-password").send({ email: "..." });
      expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
          to: "...",
      }));
  });
  ```

---

## Helpers e factories

[tests/integration/helpers/](../integration/helpers/):

- **[db.ts](../integration/helpers/db.ts)** — `getTestPrisma()`, `truncateAll()`, `seedSystemUser()`, `disconnect()`, constante `SYSTEM_USER_ID = 1`.

- **[server.ts](../integration/helpers/server.ts)** — `buildTestApp()` (cria Express via `createApp()` sem `listen`), `testAgent()` (supertest puro), `authenticatedAgent({ userId, perfil })` (supertest com `Authorization: Bearer <jwt>`).

- **[auth.ts](../integration/helpers/auth.ts)** — `signTestToken({ id, perfil })` gera JWT válido com `Config.ACCESS_TOKEN_SECRET`.

- **[factories.ts](../integration/helpers/factories.ts)** — `createUsuario`, `createCia`, `createGrupoUsuario`, `createUsuarioComAcessoCia`. Aceitam `overrides` parciais.

  Exemplo:
  ```typescript
  const admin = await createUsuario({ perfil: "ADMIN" });
  const cia = await createCia({ nome: "Acme", atualizadoPor: admin.id });
  ```

  Sem `atualizadoPor` o factory usa `SYSTEM_USER_ID` (id=1, criado pelo `seedSystemUser`).

---

## Cleanup entre testes

**SQL Server proíbe TRUNCATE em tabelas com FK referenciada.** Estratégia em `truncateAll`:

1. `ALTER TABLE x NOCHECK CONSTRAINT ALL` (desabilita FK)
2. `DELETE FROM x` (apaga linhas)
3. `DBCC CHECKIDENT(x, RESEED, 0)` (reset autoincrement)
4. `ALTER TABLE x WITH CHECK CHECK CONSTRAINT ALL` (re-habilita FK)

Tudo dentro de uma única `$executeRawUnsafe`. Se algo falhar, o próximo `beforeEach` re-tenta.

`seedSystemUser` injeta o usuário id=1 logo após o truncate, com `IDENTITY_INSERT ON` + FK desabilitada (a tabela `usuarios.atualizado_por` é self-FK).

---

## Como escrever um novo teste de integração

1. Crie arquivo em `tests/integration/[modulo]/[nome].integration.test.ts`.
2. Importe helpers (caminhos relativos, não `@/`):

   ```typescript
   import { describe, it, expect } from "vitest";
   import { authenticatedAgent } from "../helpers/server";
   import { createUsuario, createCia } from "../helpers/factories";
   import { getTestPrisma } from "../helpers/db";
   ```

3. `beforeEach` global já trunca o DB e reseed do system user — você pode partir do zero.

4. Use factories pra criar fixtures:

   ```typescript
   it("cria CIA via API", async () => {
       const admin = await createUsuario({ perfil: "ADMIN" });
       const agent = authenticatedAgent({ userId: admin.id });

       const res = await agent.post("/cia").send({ nome: "Acme" });

       expect(res.status).toBe(200);
       expect(res.body.cia.nome).toBe("Acme");
   });
   ```

5. Para um endpoint que dispara uma chamada HTTP externa, **adicione handler MSW** em `tests/integration/mocks/handlers/[api].handlers.ts` antes de rodar o teste — caso contrário, o MSW logará `UNHANDLED` warn (e a request real vai dar `ENOTFOUND`).

6. Para asserções sobre side effects de RabbitMQ ou e-mail, importe os mocks:

   ```typescript
   import { channelMock } from "../mocks/queue";
   import { sendMailMock } from "../mocks/email";

   expect(channelMock.sendToQueue).toHaveBeenCalledWith("documento-fiscal.queue", ...);
   expect(sendMailMock).toHaveBeenCalledOnce();
   ```

---

## Vitest UI

```bash
npm run test:ui                  # unit
npm run test:integration:ui      # integration
```

Abre browser em `http://localhost:51204/__vitest__/`. Cada test pode ser re-rodado em isolamento, há filtros por status, traces e visualização de snapshots.

**Atenção:** com `singleFork: true` (integração), os testes rodam serializados — clicar pra re-rodar enquanto outro está em andamento pode parecer travado. Aguarde.

---

## Coverage

**Provider:** `@vitest/coverage-v8` (V8 nativo, sem instrumentação Babel — rápido).

**Configuração compartilhada:** [vitest.coverage.shared.ts](../../vitest.coverage.shared.ts) exporta `buildCoverageConfig(reportsDirectory)` usado por ambos vitest configs. Isso evita duplicar excludes/reporters.

**Diretórios de saída separados:**
- `coverage/unit/` — apenas testes unit
- `coverage/integration/` — apenas testes de integração

**Reporters gerados:**
- `text` + `text-summary` — sai no terminal ao final do run
- `html` — relatório navegável (`coverage/{unit,integration}/index.html`)
- `lcov` — `coverage/{unit,integration}/lcov.info` (consumível por SonarQube, Codecov, etc.)
- `json-summary` — `coverage/{unit,integration}/coverage-summary.json` (CI-friendly)

**Exclude pattern** (definido em [vitest.coverage.shared.ts](../../vitest.coverage.shared.ts)):
- Entrypoints (`src/index.ts`, `src/app.ts`, `src/queue/workers.ts`, `src/cli/**`)
- Boot de cron (`src/cron/index.ts`, `src/cron/jobs/**`)
- Database boot (`src/database/clients/**`, `DatabaseManager.ts`)
- Config (`src/config/**`)
- Type-only files (`*.types.ts`, `src/@types/**`, `*.d.ts`)
- Templates de e-mail React (`src/util/emails/templates/**`)
- Setup de fila e middlewares triviais
- `tests/`, `dist/`, `node_modules/`, `prisma/`, `scripts/`

Edite essa lista em [vitest.coverage.shared.ts](../../vitest.coverage.shared.ts) quando tiver novos arquivos a excluir.

**Como rodar:**

```bash
npm run test:coverage:unit         # só unit         → coverage/unit/index.html
npm run test:integration:coverage  # só integração   → coverage/integration/index.html
npm run test:coverage:all          # ambos sequenciais
```

**Visualizar relatório HTML** (Windows):
```bash
start coverage/unit/index.html
start coverage/integration/index.html
```
ou abra manualmente no navegador.

**Thresholds:** atualmente sem mínimo enforced. Para ativar (recomendado depois que coverage estabilizar nas Fases 1+), descomente o bloco `thresholds` em [vitest.coverage.shared.ts](../../vitest.coverage.shared.ts):

```typescript
thresholds: {
    lines: 70,
    functions: 70,
    branches: 60,
    statements: 70,
}
```

Vitest falha o run se coverage < threshold. Útil em CI para impedir regressão.

**Combinar coverage unit + integration:** o V8 não combina automaticamente os dois LCOV. Em CI, use [`nyc merge`](https://github.com/istanbuljs/nyc#nyc-merge-input-output) ou [`c8 report --reporter=lcov`](https://github.com/bcoe/c8) apontando para os dois `coverage-final.json`. Localmente, basta abrir os dois HTMLs separados.

**Por que coverage está baixo agora?** Estamos em Fase 0 (só smoke tests + 3 testes legacy). Coverage subirá organicamente nas Fases 1+ (CIA expandido, ConfiguracaoContabil, Auth, Vendas, etc.). A barra é zero hoje porque a maioria dos services ainda não tem teste integração — não porque estão quebrados.

---

## Atualizar fixtures contra APIs reais

Quando o contrato de uma API externa mudar, regenere as fixtures:

1. Crie [.env.test.external](../../.env.test) (gitignored) com URLs e credenciais reais (copia do `.env` de dev).
2. Rode:
   ```bash
   npm run test:integration:external
   ```
   Esse script seta `RUN_EXTERNAL_INTEGRATION_TESTS=true`, fazendo o MSW **NÃO** iniciar. Os testes batem nas APIs reais.
3. Atualize manualmente os arquivos em `tests/integration/mocks/fixtures/` com os novos JSONs (capture os corpos via debug, log ou snapshot).
4. Rode `npm run test:integration` normalmente — agora com fixtures novas e MSW de volta.

---

## Troubleshooting

**`ENOTFOUND fake-sap.invalid` em integração** — MSW não interceptou. Verifique:
- O setup file foi carregado? (deveria printar `[integration] Banco de testes pronto.`)
- O handler para essa URL existe em `mocks/handlers/`?
- A URL no handler bate exatamente com a que axios usa? (reveja `Config.X_BASE_URL` vs handler)

**`Cannot find package '@prisma/client-s4-dotz/runtime/library'`** — Prisma client não foi gerado. Rode:
```bash
npm run prisma:generate:s4
```
O alias para esse subpath está em [vitest.integration.config.ts](../../vitest.integration.config.ts) — se mover Prisma de versão, revise.

**`No pending migrations to apply.` mas teste falha em `cia.findFirst`** — talvez o banco esteja vazio ou desatualizado. Use:
```bash
npm run db:test:reset
```

**`docker compose up --wait` trava** — cold start do SQL Server demora ~30s. Healthcheck do compose espera até 2 minutos. Se travar mais que isso, veja `docker logs s4_extensao_dotz_mssql_test`.

**Test parece preso após "Banco de testes pronto."** — provavelmente está esperando uma chamada HTTP externa. Rode com `MSW_DEBUG=true npm run test:integration` para ver todas requests interceptadas (ou não) pelo MSW.

**`Cannot read properties of null (reading 'explain')` ao instalar deps** — conflito de peer dep no npm. Instale versões pinned:
```bash
npm install --save-dev @vitest/ui@3.2.4 supertest@7 @types/supertest@6 cross-env@7 mssql@11 msw@2
```

---

## Arquivos nesta pasta

- **[vitest.setup.ts](vitest.setup.ts)** — setup global para unit tests.
- **[integration.global-setup.ts](integration.global-setup.ts)** — globalSetup do vitest integração (cria DB + migrations).
- **[integration.setup.ts](integration.setup.ts)** — setupFiles do vitest integração (MSW, mocks, cleanup).
- **README.md** — este arquivo.
