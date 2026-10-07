import { Router, static as expressStatic } from "express";
import userRoutes from "@/modules/user/routes/user.routes";
import authRoutes from "@/modules/auth/routes/auth.routes";
import path from "node:path";

import uploadConfig from "@/config/upload";
import ciaRoutes from "@/modules/cia/routes/cia.routes";
import grupoUsuarioRoutes from "@/modules/grupo-usuario/routes/grupo-usuario.routes";
import documentoFiscalRoutes from "@/modules/documento-fiscal/routes/documento-fiscal.routes";
import configuracaoContabilRoutes from "@/modules/configuracao-contabil/routes/configuracao-contabil.routes";
import contasContabeisRoutes from "@/modules/contas-contabeis/routes/contas-contabeis.routes";
import contasBancariasRoutes from "@/modules/contas-bancarias/routes/contas-bancarias.routes";
import accountfyWebhookRoutes from "@/modules/webhooks/accountfy/routes/accountfy-webhook.routes";
import relatorioRoutes from "@/modules/relatorio/routes/relatorio.routes";
import vendasRoutes from "@/modules/vendas/routes/vendas.routes";
import fluxoCaixaXtpgRoutes from "@/modules/fluxo-caixa-xtpg/routes/fluxo-caixa-xtpg.routes";
import controleExpenseRoutes from "@/modules/controle-expense/routes/controle-expense.routes";
import xtpgEnvioRoutes from "@/modules/xtpg-envio/routes/xtpg-envio.routes";
import publicFilesRoutes from "@/modules/public-files/routes/public-files.routes";
import integracoesRoutes from "@/modules/integracoes/routes/integracoes.routes";
import registrosContabeisRoutes from "@/modules/registros-contabeis/routes/registros-contabeis.routes";

const router: Router = Router();

router.use('/files', publicFilesRoutes);

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/cia', ciaRoutes);
router.use('/grupo-usuario', grupoUsuarioRoutes);
router.use('/documento-fiscal', documentoFiscalRoutes);
router.use('/configuracao-contabil', configuracaoContabilRoutes);
router.use('/contas-contabeis', contasContabeisRoutes);
router.use('/contas-bancarias', contasBancariasRoutes);
router.use('/webhooks/accountfy', accountfyWebhookRoutes);
router.use('/relatorio', relatorioRoutes);
router.use('/vendas', vendasRoutes);
router.use('/fluxo-caixa-xtpg', fluxoCaixaXtpgRoutes);
router.use('/controle-expense', controleExpenseRoutes);
router.use('/xtpg-envios', xtpgEnvioRoutes);
router.use('/integracoes', integracoesRoutes);
router.use('/registros-contabeis', registrosContabeisRoutes);
router.use("/uploads", expressStatic(uploadConfig.UPLOADS_STORAGE_FOLDER));
router.use("/uploads/avatars", expressStatic(uploadConfig.AVATARS_STORAGE_FOLDER));
router.use("/uploads/planilhas", expressStatic(uploadConfig.PLANILHAS_STORAGE_FOLDER));
router.use('/relatorios', expressStatic(uploadConfig.RELATORIOS_STORAGE_FOLDER));
router.use('/assets', expressStatic(path.resolve(__dirname, '..', '..', 'assets')));

export {  router  } ;
