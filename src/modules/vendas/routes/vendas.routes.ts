import { Router } from "express";
import multer from "multer";
import uploadConfig from "@/config/upload";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { ensureCiaAccess } from "@/middlewares/ensure-cia-access";
import { VendasBuildIntegrationJsonController } from "@/modules/vendas/controllers/VendasBuildIntegrationJsonController";
import { VendasListController } from "@/modules/vendas/controllers/VendasListController";
import { VendasCreateController } from "@/modules/vendas/controllers/VendasCreateController";
import { VendasShowController } from "@/modules/vendas/controllers/VendasShowController";
import { VendasUpdateController } from "@/modules/vendas/controllers/VendasUpdateController";
import { VendasDeleteController } from "@/modules/vendas/controllers/VendasDeleteController";
import { VendasDetalheListController } from "@/modules/vendas/controllers/VendasDetalheListController";
import { VendasDetalheCreateController } from "@/modules/vendas/controllers/VendasDetalheCreateController";
import { VendasDetalheShowController } from "@/modules/vendas/controllers/VendasDetalheShowController";
import { VendasDetalheUpdateController } from "@/modules/vendas/controllers/VendasDetalheUpdateController";
import { VendasDetalheDeleteController } from "@/modules/vendas/controllers/VendasDetalheDeleteController";
import { VendaRecDiferidaListController } from "@/modules/vendas/controllers/VendaRecDiferidaListController";
import { VendaRecDiferidaShowController } from "@/modules/vendas/controllers/VendaRecDiferidaShowController";
import { VendaRecDiferidaReprocessarController } from "@/modules/vendas/controllers/VendaRecDiferidaReprocessarController";
import { VendaRecDiferidaReverterController } from "@/modules/vendas/controllers/VendaRecDiferidaReverterController";
import { VendasReprocessarController } from "@/modules/vendas/controllers/VendasReprocessarController";
import { ReprocessarVendasLoteController } from "@/modules/vendas/controllers/ReprocessarVendasLoteController";
import { VendasConsultarBoletoController } from "@/modules/vendas/controllers/VendasConsultarBoletoController";
import { VendasDownloadArquivoController } from "@/modules/vendas/controllers/VendasDownloadArquivoController";
import { VendasProcessarController } from "@/modules/vendas/controllers/VendasProcessarController";
import { VendasReenviarEmailController } from "@/modules/vendas/controllers/VendasReenviarEmailController";

const vendasRoutes = Router();
const uploadVendaAnexos = multer(uploadConfig.MULTER).fields([
    { name: "arquivoFaturaDetalhada", maxCount: 1 },
    { name: "arquivoRelatorioAnalitico", maxCount: 1 },
]);

vendasRoutes.get(
    '/',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasListController().handle,
);

vendasRoutes.post(
    '/',
    ensureAuthenticate,
    ensureCiaAccess,
    uploadVendaAnexos,
    new VendasCreateController().handle,
);

vendasRoutes.post(
    '/reprocessar-lote',
    ensureAuthenticate,
    ensureCiaAccess,
    new ReprocessarVendasLoteController().handle,
);

vendasRoutes.get(
    '/:id',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasShowController().handle,
);

vendasRoutes.put(
    '/:id',
    ensureAuthenticate,
    ensureCiaAccess,
    uploadVendaAnexos,
    new VendasUpdateController().handle,
);

vendasRoutes.delete(
    '/:id',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasDeleteController().handle,
);

vendasRoutes.get(
    '/:id/detalhes',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasDetalheListController().handle,
);

vendasRoutes.post(
    '/:id/detalhes',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasDetalheCreateController().handle,
);

vendasRoutes.get(
    '/:headerId/detalhes/:detalheId',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasDetalheShowController().handle,
);

vendasRoutes.put(
    '/:id/detalhes/:detalheId',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasDetalheUpdateController().handle,
);

vendasRoutes.delete(
    '/:id/detalhes/:detalheId',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasDetalheDeleteController().handle,
);

vendasRoutes.post(
    '/:id/gerar-json-integracao',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasBuildIntegrationJsonController().handle,
);

vendasRoutes.post(
    '/:id/processar',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasProcessarController().handle,
);

vendasRoutes.post(
    '/:id/reprocessar',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasReprocessarController().handle,
);

vendasRoutes.post(
    '/:id/consultar-boleto',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasConsultarBoletoController().handle,
);

vendasRoutes.post(
    '/:id/reenviar-email',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasReenviarEmailController().handle,
);

vendasRoutes.get(
    '/:id/download/:tipo',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendasDownloadArquivoController().handle,
);

vendasRoutes.get(
    '/:id/diferidas',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendaRecDiferidaListController().handle,
);

vendasRoutes.get(
    '/:id/diferidas/:difeididaId',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendaRecDiferidaShowController().handle,
);

vendasRoutes.post(
    '/:id/diferidas/:difeididaId/reprocessar',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendaRecDiferidaReprocessarController().handle,
);

vendasRoutes.post(
    '/:id/diferidas/:difeididaId/reverter',
    ensureAuthenticate,
    ensureCiaAccess,
    new VendaRecDiferidaReverterController().handle,
);

export default vendasRoutes;
