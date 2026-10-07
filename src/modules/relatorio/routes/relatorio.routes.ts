import { Router } from 'express';
import { ensureAuthenticate } from '@/middlewares/ensure-authenticated';
import { permissionsRequired } from '@/middlewares/verify-user-authorization';
import { Perfil } from '@/@types/PermissionsTypes';
import { RelatorioCreateController } from '@/modules/relatorio/controllers/RelatorioCreateController';
import { RelatorioListController } from '@/modules/relatorio/controllers/RelatorioListController';
import { RelatorioShowController } from '@/modules/relatorio/controllers/RelatorioShowController';
import { RelatorioUpdateController } from '@/modules/relatorio/controllers/RelatorioUpdateController';
import { RelatorioDeleteController } from '@/modules/relatorio/controllers/RelatorioDeleteController';
import { RelatorioExecuteController } from '@/modules/relatorio/controllers/RelatorioExecuteController';
import { RelatorioExportController } from '@/modules/relatorio/controllers/RelatorioExportController';
import { RelatorioSchemaController } from '@/modules/relatorio/controllers/RelatorioSchemaController';

const relatorioRoutes: Router = Router();

relatorioRoutes.get(
    '/',
    ensureAuthenticate,
    new RelatorioListController().handle,
);

relatorioRoutes.post(
    '/',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RelatorioCreateController().handle,
);

relatorioRoutes.get(
    '/schema/databases',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RelatorioSchemaController().handle,
);

relatorioRoutes.get(
    '/:id',
    ensureAuthenticate,
    new RelatorioShowController().handle,
);

relatorioRoutes.put(
    '/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RelatorioUpdateController().handle,
);

relatorioRoutes.delete(
    '/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RelatorioDeleteController().handle,
);

relatorioRoutes.post(
    '/:id/executar',
    ensureAuthenticate,
    new RelatorioExecuteController().handle,
);

relatorioRoutes.post(
    '/:id/exportar',
    ensureAuthenticate,
    new RelatorioExportController().handle,
);

export default relatorioRoutes;
