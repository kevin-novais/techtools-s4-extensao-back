import { Router } from "express";
import multer from "multer";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { ensureCiaAccess } from "@/middlewares/ensure-cia-access";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import uploadConfig from "@/config/upload";

// Documentos Fiscais Gerais
import { DocumentoListController } from "@/modules/documento-fiscal/documento-header/documento/controllers/DocumentosListController";
import { DocumentoShowController } from "@/modules/documento-fiscal/documento-header/documento/controllers/DocumentoShowController";
import { DocumentoErrorsListController } from "@/modules/documento-fiscal/documento-details/documento/controllers/DocumentoErrorsListController";
import { DocumentoDetalheShowController } from "@/modules/documento-fiscal/documento-details/documento/controllers/DocumentoDetalheShowController";
import { DocumentoDetalheListController } from "@/modules/documento-fiscal/documento-details/documento/controllers/DocumentoDetalheListController";
import { DocumentoRelatorioController } from "@/modules/documento-fiscal/documento-header/documento/controllers/DocumentoRelatorioController";
import { DocumentoDownloadController } from "@/modules/documento-fiscal/documento-header/documento/controllers/DocumentoDownloadController";


// Documentos Fiscais Romaneio
import { RomaneioUploadRomaneioController } from "@/modules/documento-fiscal/documento-header/romaneio/controllers/RomaneioUploadRomaneioController";
import { RomaneioDeleteController } from "@/modules/documento-fiscal/documento-header/romaneio/controllers/RomaneioDeleteController";
import { RomaneioRevalidarController } from "@/modules/documento-fiscal/documento-header/romaneio/controllers/RomaneioRevalidarController";
import { PosCreateController } from "@/modules/documento-fiscal/documento-header/pos/controllers/PosCreateController";
import { PosReprocessarController } from "@/modules/documento-fiscal/documento-header/pos/controllers/PosReprocessarController";

// Documentos Fiscais POS
import { PosListFilterAnalyzerController } from "@/modules/documento-fiscal/documento-details/pos/controllers/PosListFilterAnalyzerController";
import { PosGrupoListController } from "@/modules/documento-fiscal/documento-details/pos/controllers/PosGrupoListController";
import { PosExportController } from "@/modules/documento-fiscal/documento-details/pos/controllers/PosExportController";
import { PosExportCountController } from "@/modules/documento-fiscal/documento-details/pos/controllers/PosExportCountController";
import { DocumentoFiscalBuildIntegrationJsonController } from "../documento-header/documento/controllers/DocumentoBuildIntegrationJsonController";
import { DocumentoFiscalApproveController } from "../documento-header/documento/controllers/DocumentoApproveController";


const uploadXlsx = multer(uploadConfig.MULTER_XLSX);

const documentoFiscalRoutes: Router = Router();

// Documentos Fiscais Documentos Gerais
documentoFiscalRoutes.get(
    '/',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoListController().handle
);

documentoFiscalRoutes.get(
    '/:id',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoShowController().handle
);

documentoFiscalRoutes.get(
    '/:id/relatorio',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoRelatorioController().handle
);

documentoFiscalRoutes.get(
    '/:id/download',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoDownloadController().handle
);

documentoFiscalRoutes.get(
    '/:id/divergencias',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoErrorsListController().handle
);

documentoFiscalRoutes.get(
    '/:headerId/detalhes/:detalheId',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoDetalheShowController().handle
);

documentoFiscalRoutes.get(
    '/:id/detalhes',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoDetalheListController().handle
);

documentoFiscalRoutes.post(
    '/:id/gerar-json-integracao',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoFiscalBuildIntegrationJsonController().handle
);

documentoFiscalRoutes.post(
    '/:id/aprovar',
    ensureAuthenticate,
    ensureCiaAccess,
    new DocumentoFiscalApproveController().handle
);

// Documentos Fiscais Romaneio
documentoFiscalRoutes.post(
    '/upload-romaneio',
    ensureAuthenticate,
    uploadXlsx.single('arquivo'),
    new RomaneioUploadRomaneioController().handle
);

documentoFiscalRoutes.post(
    '/:id/revalidar',
    ensureAuthenticate,
    ensureCiaAccess,
    uploadXlsx.single('arquivo'), // opcional: sem arquivo reprocessa a planilha já armazenada
    new RomaneioRevalidarController().handle
);

documentoFiscalRoutes.delete(
    '/:id',
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new RomaneioDeleteController().handle
);




// Documentos Fiscais POS

documentoFiscalRoutes.get(
    '/pos/segmentos',
    ensureAuthenticate,
    new PosGrupoListController().handle
);

documentoFiscalRoutes.get(
    '/pos/list-filter-analyzer',
    ensureAuthenticate,
    new PosListFilterAnalyzerController().handle
);

documentoFiscalRoutes.get(
    '/pos/export/count',
    ensureAuthenticate,
    new PosExportCountController().handle
);

documentoFiscalRoutes.get(
    '/pos/export',
    ensureAuthenticate,
    new PosExportController().handle
);

documentoFiscalRoutes.post(
    '/pos/create',
    ensureAuthenticate,
    ensureCiaAccess,
    new PosCreateController().handle
);

documentoFiscalRoutes.post(
    '/:id/reprocessar-pos',
    ensureAuthenticate,
    ensureCiaAccess,
    new PosReprocessarController().handle
);

export default documentoFiscalRoutes;

