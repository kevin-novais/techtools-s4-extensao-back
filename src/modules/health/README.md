# Health check (DTZ-320)

Endpoint único para validar, na **virada produtiva**, se todas as conexões / URLs /
IPs / portas estão liberadas no ambiente. Todos os testes são **read-only** (GET /
consulta de metadados / autenticação) — nada é inserido ou alterado.

## Endpoints

| Rota | Auth | O que faz |
|------|------|-----------|
| `GET /health/live` | aberto | Liveness: só diz que o processo está de pé, **sem I/O**. Serve para probe. |
| `GET /health` | `Authorization: Bearer <token>` | Roda todos os checks. **200** se tudo ok, **503** se algum falhou. |

O token do `/health` pode ser (ver `ensure-health-access.ts`):
- a **`APP_API_KEY`** — acesso máquina-a-máquina (curl da virada, monitor externo); ou
- um **JWT de usuário com perfil `ADMIN`** — a tela da aba Administrador usa a sessão logada,
  sem que a `APP_API_KEY` vá para o navegador.

Falha → **401** (sem credencial / JWT inválido) ou **403** (logado, mas não é ADMIN).

Formato da resposta de `/health`:
- **JSON** (default) — o front (aba Administrador) consome direto.
- **HTML** — `?format=html` ou `Accept: text/html`. Tabela legível com OK/FALHOU,
  o alvo (host:porta / URL) testado e o tempo de resposta de cada ponto.

## Modo "APENAS health check"

Variável **`HEALTH_CHECK_ONLY=true`**: a app sobe só para validar acessos e **não
executa nada que afete produção** — não roda cron, não consome filas do RabbitMQ e
não monta as rotas de negócio. Assim dá para ligar em produção, junto dos sistemas
atuais, sem concorrer com eles. Default `false`.

## Os dois containers

- **API** (`npm run start`): monta `/health` no app principal (porta `PORT`).
- **Consumer** (`npm run start:workers`): não expunha HTTP; passa a subir um servidor
  mínimo só com as rotas de health na porta **`HEALTH_CHECK_PORT`** (default `8576`).

Cada container se identifica no relatório (campo `container`) via
`HEALTH_CONTAINER_NAME` (default `api` / `consumer`), para confirmar que **ambos**
foram testados.

## Pontos verificados

Bancos (`SELECT 1`): s4-extensao-dotz, dotz-stage-troca, usuário de report ·
RabbitMQ (conecta + abre canal, **sem consumir**) · Integrações: SAP (token OAuth),
XTPG (WSDL), Invent (authenticate), Vexpense (GET leve), Accountfy (entrada: valida
`APP_API_KEY`; dados via BD s4), Google Storage (`bucket.exists()`), ELK (GET no node).

> Nota: SAP, XTPG e Invent autenticam de fato (login/token). É um POST no endpoint de
> **autenticação** — não grava dado de negócio — necessário para provar que a porta
> está liberada **e** a credencial é válida. Se for exigido 100% GET, esses viram só
> "a URL responde".
