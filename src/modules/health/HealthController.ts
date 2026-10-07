/**
 * DTZ-320 - expoe o relatorio de health check.
 *   GET /health        -> roda todos os checks. 200 se tudo ok, 503 se algo falhou.
 *                         Saida JSON (default) ou HTML (?format=html ou Accept: text/html).
 *   GET /health/live   -> liveness: so diz que o processo esta de pe, SEM I/O (para probe).
 */
import type { Request, Response } from 'express';
import { HealthCheckService } from '@/modules/health/HealthCheckService';
import type { HealthReport } from '@/modules/health/types/health.types';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderHtml(report: HealthReport): string {
    const overallOk = report.status === 'ok';
    const rows = report.checks
        .map((c) => {
            const ok = c.status === 'ok';
            const badge = ok
                ? '<span class="badge ok">OK</span>'
                : '<span class="badge fail">FALHOU</span>';
            return `<tr class="${ok ? '' : 'row-fail'}">
                <td>${escapeHtml(c.name)}</td>
                <td class="mono">${escapeHtml(c.target)}</td>
                <td>${badge}</td>
                <td class="mono">${c.latencyMs} ms</td>
                <td>${escapeHtml(c.detail ?? '')}</td>
            </tr>`;
        })
        .join('');

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Health check - s4-extensao-dotz</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; line-height: 1.4; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
  .status { display: inline-block; padding: 6px 14px; border-radius: 6px; font-weight: 700; color: #fff; }
  .status.ok { background: #157347; }
  .status.fail { background: #b02a37; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { background: rgba(127,127,127,.12); }
  .row-fail { background: rgba(176,42,55,.08); }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; color: #fff; }
  .badge.ok { background: #157347; }
  .badge.fail { background: #b02a37; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
</style>
</head>
<body>
  <h1>Health check &mdash; s4-extensao-dotz</h1>
  <div class="meta">
    modo: <strong>${escapeHtml(report.mode)}</strong> &middot;
    container: <strong>${escapeHtml(report.container)}</strong> &middot;
    ambiente: <strong>${escapeHtml(report.environment)}</strong> &middot;
    ${escapeHtml(report.generatedAt)} &middot; ${report.durationMs} ms
  </div>
  <div class="status ${overallOk ? 'ok' : 'fail'}">
    ${overallOk ? 'TODOS OS PONTOS OK' : 'FALHA EM ALGUM PONTO'}
    (${report.summary.ok}/${report.summary.total})
  </div>
  <table>
    <thead>
      <tr><th>Ponto testado</th><th>Alvo (host:porta / URL)</th><th>Status</th><th>Tempo</th><th>Detalhe</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function wantsHtml(req: Request): boolean {
    const format = String(req.query.format || '').toLowerCase();
    if (format === 'html') return true;
    if (format === 'json') return false;
    return req.accepts(['json', 'html']) === 'html';
}

export class HealthController {
    async check(req: Request, res: Response): Promise<void> {
        const report = await new HealthCheckService().run();
        const httpStatus = report.status === 'ok' ? 200 : 503;

        if (wantsHtml(req)) {
            res.status(httpStatus).type('html').send(renderHtml(report));
            return;
        }
        res.status(httpStatus).json(report);
    }

    live(_req: Request, res: Response): void {
        res.status(200).json({
            status: 'live',
            container: HealthCheckService.resolveContainer(),
            timestamp: new Date().toISOString(),
        });
    }
}
