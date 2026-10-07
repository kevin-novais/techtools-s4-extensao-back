import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import { ConfiguracaoContabilListController } from "@/modules/configuracao-contabil/controllers/ConfiguracaoContabilListController";
import { ConfiguracaoContabilCreateController } from "@/modules/configuracao-contabil/controllers/ConfiguracaoContabilCreateController";
import { ConfiguracaoContabilShowController } from "@/modules/configuracao-contabil/controllers/ConfiguracaoContabilShowController";
import { ConfiguracaoContabilUpdateController } from "@/modules/configuracao-contabil/controllers/ConfiguracaoContabilUpdateController";
import { ConfiguracaoContabilDeleteController } from "@/modules/configuracao-contabil/controllers/ConfiguracaoContabilDeleteController";
import { ConfiguracaoContabilDetalheListController } from "@/modules/configuracao-contabil/controllers/detalhes/ConfiguracaoContabilDetalheListController";
import { ConfiguracaoContabilDetalheCreateController } from "@/modules/configuracao-contabil/controllers/detalhes/ConfiguracaoContabilDetalheCreateController";
import { ConfiguracaoContabilDetalheShowController } from "@/modules/configuracao-contabil/controllers/detalhes/ConfiguracaoContabilDetalheShowController";
import { ConfiguracaoContabilDetalheUpdateController } from "@/modules/configuracao-contabil/controllers/detalhes/ConfiguracaoContabilDetalheUpdateController";
import { ConfiguracaoContabilDetalheDeleteController } from "@/modules/configuracao-contabil/controllers/detalhes/ConfiguracaoContabilDetalheDeleteController";
import { ConfiguracaoContabilDetalhePontoListController } from "@/modules/configuracao-contabil/controllers/pontos/ConfiguracaoContabilDetalhePontoListController";
import { ConfiguracaoContabilDetalhePontoCreateController } from "@/modules/configuracao-contabil/controllers/pontos/ConfiguracaoContabilDetalhePontoCreateController";
import { ConfiguracaoContabilDetalhePontoShowController } from "@/modules/configuracao-contabil/controllers/pontos/ConfiguracaoContabilDetalhePontoShowController";
import { ConfiguracaoContabilDetalhePontoUpdateController } from "@/modules/configuracao-contabil/controllers/pontos/ConfiguracaoContabilDetalhePontoUpdateController";
import { ConfiguracaoContabilDetalhePontoDeleteController } from "@/modules/configuracao-contabil/controllers/pontos/ConfiguracaoContabilDetalhePontoDeleteController";

const configuracaoContabilRoutes: Router = Router();

// Rotas da configuração contábil (tabela mãe)
configuracaoContabilRoutes.get(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilListController().handle,
);

configuracaoContabilRoutes.post(
    "/",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilCreateController().handle,
);

configuracaoContabilRoutes.get(
    "/:id",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilShowController().handle,
);

configuracaoContabilRoutes.put(
    "/:id",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilUpdateController().handle,
);

configuracaoContabilRoutes.delete(
    "/:id",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDeleteController().handle,
);

// Rotas dos detalhes da configuração contábil
configuracaoContabilRoutes.get(
    "/:configuracaoContabilId/detalhes",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalheListController().handle,
);

configuracaoContabilRoutes.post(
    "/:configuracaoContabilId/detalhes",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalheCreateController().handle,
);

configuracaoContabilRoutes.get(
    "/:configuracaoContabilId/detalhes/:detalheId",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalheShowController().handle,
);

configuracaoContabilRoutes.put(
    "/:configuracaoContabilId/detalhes/:detalheId",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalheUpdateController().handle,
);

configuracaoContabilRoutes.delete(
    "/:configuracaoContabilId/detalhes/:detalheId",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalheDeleteController().handle,
);

// Rotas dos pontos da configuração contábil
configuracaoContabilRoutes.get(
    "/:configuracaoContabilId/pontos",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalhePontoListController().handle,
);

configuracaoContabilRoutes.post(
    "/:configuracaoContabilId/pontos",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalhePontoCreateController().handle,
);

configuracaoContabilRoutes.get(
    "/:configuracaoContabilId/pontos/:pontoId",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalhePontoShowController().handle,
);

configuracaoContabilRoutes.put(
    "/:configuracaoContabilId/pontos/:pontoId",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalhePontoUpdateController().handle,
);

configuracaoContabilRoutes.delete(
    "/:configuracaoContabilId/pontos/:pontoId",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new ConfiguracaoContabilDetalhePontoDeleteController().handle,
);

export default configuracaoContabilRoutes;


