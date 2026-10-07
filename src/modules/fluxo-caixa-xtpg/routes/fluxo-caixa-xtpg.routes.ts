import { Router } from "express";
import { ensureAuthenticate } from "@/middlewares/ensure-authenticated";
import { permissionsRequired } from "@/middlewares/verify-user-authorization";
import { Perfil } from "@/@types/PermissionsTypes";
import { OcrFornecedorListController } from "@/modules/fluxo-caixa-xtpg/controllers/OcrFornecedorListController";
import { OcrFornecedorComboboxCursorListController } from "@/modules/fluxo-caixa-xtpg/controllers/OcrFornecedorComboboxCursorListController";
import { FluxoCaixaCiaParceiroListController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaParceiroListController";
import { FluxoCaixaCiaParceiroShowController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaParceiroShowController";
import { FluxoCaixaCiaParceiroCreateController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaParceiroCreateController";
import { FluxoCaixaCiaParceiroUpdateController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaParceiroUpdateController";
import { FluxoCaixaCiaParceiroDeleteController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaParceiroDeleteController";
import { FluxoCaixaCiaTipoLancamentoListController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaTipoLancamentoListController";
import { FluxoCaixaCiaTipoLancamentoShowController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaTipoLancamentoShowController";
import { FluxoCaixaCiaTipoLancamentoCreateController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaTipoLancamentoCreateController";
import { FluxoCaixaCiaTipoLancamentoUpdateController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaTipoLancamentoUpdateController";
import { FluxoCaixaCiaTipoLancamentoDeleteController } from "@/modules/fluxo-caixa-xtpg/controllers/FluxoCaixaCiaTipoLancamentoDeleteController";
import { ClassificacaoFluxoCaixaXtpgRunController } from "@/modules/fluxo-caixa-xtpg/controllers/ClassificacaoFluxoCaixaXtpgRunController";

const fluxoCaixaXtpgRoutes: Router = Router();

const classificacaoFluxoCaixaXtpgRunController = new ClassificacaoFluxoCaixaXtpgRunController();

fluxoCaixaXtpgRoutes.get(
    "/fornecedores/combobox",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new OcrFornecedorComboboxCursorListController().handle,
);

fluxoCaixaXtpgRoutes.get(
    "/fornecedores",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new OcrFornecedorListController().handle,
);

fluxoCaixaXtpgRoutes.get(
    "/parceiros/vinculos",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaParceiroListController().handle,
);

fluxoCaixaXtpgRoutes.get(
    "/parceiro-vinculo",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaParceiroShowController().handle,
);

fluxoCaixaXtpgRoutes.post(
    "/parceiro-vinculo",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaParceiroCreateController().handle,
);

fluxoCaixaXtpgRoutes.put(
    "/parceiro-vinculo",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaParceiroUpdateController().handle,
);

fluxoCaixaXtpgRoutes.delete(
    "/parceiro-vinculo",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaParceiroDeleteController().handle,
);

fluxoCaixaXtpgRoutes.get(
    "/tipo-lancamento",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaTipoLancamentoListController().handle,
);

fluxoCaixaXtpgRoutes.get(
    "/tipo-lancamento/detail",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaTipoLancamentoShowController().handle,
);

fluxoCaixaXtpgRoutes.post(
    "/tipo-lancamento",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaTipoLancamentoCreateController().handle,
);

fluxoCaixaXtpgRoutes.put(
    "/tipo-lancamento",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaTipoLancamentoUpdateController().handle,
);

fluxoCaixaXtpgRoutes.delete(
    "/tipo-lancamento",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    new FluxoCaixaCiaTipoLancamentoDeleteController().handle,
);

fluxoCaixaXtpgRoutes.post(
    "/classificar-lote",
    ensureAuthenticate,
    permissionsRequired(Perfil.ADMIN),
    classificacaoFluxoCaixaXtpgRunController.handle,
);

export default fluxoCaixaXtpgRoutes;
