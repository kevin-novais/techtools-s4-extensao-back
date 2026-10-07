# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexto

Backend de integração da Dotz (empresa de pontos trocados por produtos físicos) com SAP S/4HANA Cloud, Vexpenses e o banco de dados de staging `Dotz_Stage_Trocas`. O sistema gerencia documentos fiscais, configurações contábeis e sincronização de dados entre plataformas.

## Comandos

```bash
# Desenvolvimento
npm run dev                        # Inicia com hot-reload (ts-node-dev)
npm run build                      # Compila TypeScript para /dist
npm start                          # Executa o build de produção

# Testes
npm test                           # Todos os testes unitários
npm run test:watch                 # Modo watch
npm run test:coverage              # Relatório de cobertura
npm run test:integration           # Testes de integração

# Rodar arquivo ou pasta específica:
npm run test -- tests/unit/configuracao-contabil/ --run
npm run test -- tests/unit/configuracao-contabil/configuracao-contabil-header.unit.test.ts --run

# Prisma
npm run prisma:generate            # Gera ambos os clients Prisma
npm run prisma:migrate:s4          # Migration de desenvolvimento (banco principal)
npm run prisma:migrate:deploy:s4   # Deploy de migration em produção
npm run prisma:seed:s4             # Seed do banco principal

# CLI
npm run cli                        # Operações de manutenção/sincronização
```

## Arquitetura

**Dois entry points:**

- `src/index.ts` — API REST Express (porta 5858)
- `src/queue/workers.ts` — Workers RabbitMQ (serviço Docker separado)

**Fluxo de dados:**
```
Requisição HTTP → Controller → Service (execute) → Prisma → SQL Server
                                    ↓
                                RabbitMQ → Consumer → SAP / Vexpenses APIs
                                    ↑
                          Cron Jobs (node-cron, sincronização agendada)
```

**Dois bancos SQL Server via Prisma:**

- `s4_extensao_dotz` (principal) — todos os dados da aplicação; schema em `prisma/s4_extensao_dotz/schema.prisma`
- `Dotz_Stage_Trocas` (somente leitura) — banco externo SAP Analyzer/Stage; schema em `prisma/dotz-stage/schema.prisma`

Os clients Prisma são singletons gerenciados por `src/database/DatabaseManager.ts`.

**Filas RabbitMQ** (todas com Dead Letter Exchange para mensagens com falha):

- `email.queue` — envio assíncrono de e-mails
- `documento-fiscal.queue` — processamento de documentos fiscais
- `sap-integration.queue` — chamadas à API SAP
- `vexpenses-integration.queue` — sincronização com Vexpenses

**Cron Jobs** (`src/cron/`):

- Sync de parceiros/fornecedores SAP (diário às 9h)
- Sync de registros contábeis (a cada 3h)
- Relatórios aprovados Vexpenses (quintas às 20h)
- Liquidação de pagamentos Vexpenses (a cada 2h)

**Alias de path:** `@/*` mapeia para `src/*` (configurado no tsconfig e resolvido em build pelo `tsc-alias`).

## Estrutura de Módulos

Cada módulo em `src/modules/[nome-do-modulo]/` segue:

```
src/modules/[nome-do-modulo]/
├── controllers/   # Recebe requisições HTTP, valida dados básicos, chama o Service
├── services/      # Lógica de negócio — sempre classe com método execute()
├── routes/        # Endpoints Express com middlewares de auth
└── utils/         # Funções auxiliares do módulo (opcional)
```

## Padrões de Código

### Classes e Serviços

- Sempre usar orientação a objetos com classes
- O método público principal deve ser chamado `execute`
- Métodos auxiliares devem ser privados
- Injetar dependências pelo construtor

### Controle de Fluxo — Early Returns (obrigatório)

**Evitar if-else aninhado.** Usar guard clauses:

```typescript
// ❌ NÃO FAZER
async execute(id: number) {
    const item = await this.findItem(id);
    if (item) {
        if (item.status === 'ATIVO') {
            return this.processar(item);
        } else {
            throw new AppError("Status inválido", 400);
        }
    } else {
        throw new AppError("Item não encontrado", 404);
    }
}

// ✅ FAZER
async execute(id: number) {
    const item = await this.findItem(id);

    if (!item) throw new AppError("Item não encontrado", 404);
    if (item.status !== 'ATIVO') throw new AppError("Status inválido", 400);

    return this.processar(item);
}
```

Validações primeiro, lógica de negócio no final do método sem indentação extra.

### Performance com Prisma

Sempre usar `include` para JOINs em vez de múltiplas queries:

```typescript
// ❌ NÃO FAZER
const pedido = await client.pedido.findUnique({ where: { id } });
const fornecedor = await client.fornecedor.findUnique({ where: { id: pedido.fornecedorId } });

// ✅ FAZER
const pedido = await client.pedido.findUnique({
    where: { id },
    include: { fornecedor: { select: { nome: true, codigo: true } } },
});
```

- Usar `select` para trazer apenas campos necessários
- Sempre paginar listagens com `skip` e `take`
- Evitar N+1 queries: carregar relacionamentos com `include` ao listar

## Utilitários de Data

Todas as funções estão em `src/util/date.ts`. Usar sempre o utilitário correto:

| Situação | Função |
| --- | --- |
| Datas de negócio sem hora (`dataEmissao`, `dataLancamento`) | `formatDateOnly()` |
| Timestamps com hora (`criadoEm`, `atualizadoEm`) | `formatDateToBrazilianTimezone()` |
| Comparação de datas vindas do banco | `normalizeDateToMidnightUTC()` antes de comparar |
| Converter string YYYY-MM-DD de formulário/API | `parseDateAsBrazilian()` |
| Filtro de período — data inicial | `parseDateForFilter()` (00:00:00 UTC) |
| Filtro de período — data final | `parseDateForFilterEnd()` (23:59:59 UTC) |

> **Atenção:** Nunca usar `formatDateToBrazilianDate()` em datas de negócio — causa deslocamento de 1 dia.

## Testes Unitários

Testes ficam em `tests/unit/**/*.unit.test.ts`. Ver exemplos de referência em `tests/unit/configuracao-contabil/`.

### Imports nos testes

Usar **caminhos relativos** (não `@/`) para evitar erros de resolução na IDE:

```typescript
// ✅ Correto
import { MeuService } from "../../../src/modules/meu-modulo/services/MeuService";
import AppError from "../../../src/util/AppError";
import s4DotzClient from "../../../src/database/clients/s4DotzClient";

// ❌ Evitar
import { MeuService } from "@/modules/meu-modulo/services/MeuService";
```

O mesmo vale para `vi.mock` — usar o caminho relativo que resolve para o mesmo arquivo que o módulo importa internamente.

### Estrutura padrão de teste

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MeuService } from "../../../src/modules/...";
import AppError from "../../../src/util/AppError";

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        meuModelo: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    },
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("MeuService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deve lançar AppError 404 quando não encontrado", async () => {
        vi.mocked(s4DotzClient.meuModelo.findUnique).mockResolvedValue(null);

        const service = new MeuService();
        await expect(service.execute({ id: 999 })).rejects.toMatchObject({
            message: "Recurso não encontrado",
            statusCode: 404,
        });
    });
});
```

### Mocks comuns

```typescript
// Prisma Decimal
aliquotaPis: { toNumber: () => 1.65 },

// formatDateToBrazilianTimezone — saída determinística
vi.mock("../../../src/util/date", () => ({
    formatDateToBrazilianTimezone: vi.fn((d: Date) => (d ? d.toISOString() : "")),
}));
```

## Utilitários Principais

- `src/util/AppError.ts` — classe de erro customizada; usar em todas as validações de negócio
- `src/util/logger.ts` — logging estruturado com Winston
- `src/util/date.ts` — helpers de timezone Brasil (ver tabela acima)
- `src/config/config.ts` — carregamento centralizado de variáveis de ambiente; toda config vem daqui
