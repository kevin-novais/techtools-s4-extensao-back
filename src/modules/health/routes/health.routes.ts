/**
 * DTZ-320 - rotas do health check.
 *   /health/live : liveness aberto (sem I/O), para probe do k8s.
 *   /health      : relatorio completo de conectividade. Protegido por APP_API_KEY
 *                  (integração/curl) OU JWT de usuário ADMIN (tela da aba
 *                  Administrador) - ver ensure-health-access. Expõe topologia de
 *                  infra, então nunca fica aberto.
 */
import { Router } from 'express';
import { HealthController } from '@/modules/health/HealthController';
import { ensureHealthAccess } from '@/middlewares/ensure-health-access';

const healthRoutes: Router = Router();
const controller = new HealthController();

healthRoutes.get('/health/live', (req, res) => controller.live(req, res));
healthRoutes.get('/health', ensureHealthAccess, (req, res) => controller.check(req, res));

export default healthRoutes;
