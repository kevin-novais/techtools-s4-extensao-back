import { ConfiguracaoContabil, ConfiguracaoContabilDetalhe, ConfiguracaoContabilDetalhePonto, Usuario, Cia } from "@prisma/client-s4-dotz";
import { formatDateToBrazilianTimezone } from "@/util/date";

type UsuarioResumo = Pick<Usuario, "id" | "nome" | "email">;
type CiaResumo = Pick<Cia, "id" | "nome">;

type ConfiguracaoContabilWithRelations = ConfiguracaoContabil & {
    cia?: CiaResumo | null;
    criadoPorUsuario?: UsuarioResumo | null;
    atualizadoPorUsuario?: UsuarioResumo | null;
    configuracaoContabilDetalhes?: ConfiguracaoContabilDetalhe[];
};

type ConfiguracaoContabilDetalheWithUsers = ConfiguracaoContabilDetalhe & {
    criadoPorUsuario?: UsuarioResumo | null;
    atualizadoPorUsuario?: UsuarioResumo | null;
};

type ConfiguracaoContabilDetalhePontoWithUsers = ConfiguracaoContabilDetalhePonto & {
    criadoPorUsuario?: UsuarioResumo | null;
    atualizadoPorUsuario?: UsuarioResumo | null;
};

const formatUsuario = (usuario?: UsuarioResumo | null) =>
    usuario
        ? {
              id: usuario.id,
              nome: usuario.nome,
              email: usuario.email,
          }
        : null;

const formatCia = (cia?: CiaResumo | null) =>
    cia
        ? {
              id: cia.id,
              nome: cia.nome,
          }
        : null;

export const formatConfiguracaoContabilDetalhePonto = (record: ConfiguracaoContabilDetalhePontoWithUsers) => ({
    id: record.id,
    configuracaoContabilId: record.configuracaoContabilId,
    ehPadrao: record.ehPadrao,
    codigoPonto: record.codigoPonto,
    descricaoPonto: record.descricaoPonto,
    custoPonto: record.custoPonto ? record.custoPonto.toNumber() : null,
    contaCredito: record.contaCredito,
    contaDebito: record.contaDebito,
    centroCusto: record.centroCusto,
    centroLucro: record.centroLucro,
    contaCreditoReceitaExpiracao: record.contaCreditoReceitaExpiracao,
    contaCreditoReceitaVendas: record.contaCreditoReceitaVendas,
    contaCreditoReceitaResgate: record.contaCreditoReceitaResgate,
    grupoPisCofins: record.grupoPisCofins,
    aliquotaPis: record.aliquotaPis ? record.aliquotaPis.toNumber() : null,
    aliquotaCofins: record.aliquotaCofins ? record.aliquotaCofins.toNumber() : null,
    contaCreditoPis: record.contaCreditoPis,
    contaDebitoPis: record.contaDebitoPis,
    contaCreditoCofins: record.contaCreditoCofins,
    contaDebitoCofins: record.contaDebitoCofins,
    criadoPor: record.criadoPor,
    criadoPorUsuario: formatUsuario(record.criadoPorUsuario),
    criadoEm: formatDateToBrazilianTimezone(record.criadoEm),
    atualizadoPor: record.atualizadoPor,
    atualizadoPorUsuario: formatUsuario(record.atualizadoPorUsuario),
    atualizadoEm: formatDateToBrazilianTimezone(record.atualizadoEm),
});

export const formatConfiguracaoContabilDetalhe = (record: ConfiguracaoContabilDetalheWithUsers) => ({
    id: record.id,
    configuracaoContabilId: record.configuracaoContabilId,
    codigoItem: record.codigoItem,
    grupoPisCofins: record.grupoPisCofins,
    validarDivergencia: record.validarDivergencia,
    aliquotaPis: record.aliquotaPis ? record.aliquotaPis.toNumber() : null,
    aliquotaCofins: record.aliquotaCofins ? record.aliquotaCofins.toNumber() : null,
    contaCreditoPis: record.contaCreditoPis,
    contaDebitoPis: record.contaDebitoPis,
    contaCreditoCofins: record.contaCreditoCofins,
    contaDebitoCofins: record.contaDebitoCofins,
    contaCreditoValorProduto: record.contaCreditoValorProduto,
    contaDebitoValorProduto: record.contaDebitoValorProduto,
    contaCreditoValorFrete: record.contaCreditoValorFrete,
    contaDebitoValorFrete: record.contaDebitoValorFrete,
    contaCreditoValorCombo: record.contaCreditoValorCombo,
    contaDebitoValorCombo: record.contaDebitoValorCombo,
    contaCreditoValorIs: record.contaCreditoValorIs,
    contaDebitoValorIs: record.contaDebitoValorIs,
    contaCreditoValorCbs: record.contaCreditoValorCbs,
    contaDebitoValorCbs: record.contaDebitoValorCbs,
    contaCreditoValorIbsUf: record.contaCreditoValorIbsUf,
    contaDebitoValorIbsUf: record.contaDebitoValorIbsUf,
    contaCreditoValorIbsMunicipal: record.contaCreditoValorIbsMunicipal,
    contaDebitoValorIbsMunicipal: record.contaDebitoValorIbsMunicipal,
    centroCusto: record.centroCusto,
    centroLucro: record.centroLucro,
    criadoPor: record.criadoPor,
    criadoPorUsuario: formatUsuario(record.criadoPorUsuario),
    criadoEm: formatDateToBrazilianTimezone(record.criadoEm),
    atualizadoPor: record.atualizadoPor,
    atualizadoPorUsuario: formatUsuario(record.atualizadoPorUsuario),
    atualizadoEm: formatDateToBrazilianTimezone(record.atualizadoEm),
});

export const formatConfiguracaoContabil = (record: ConfiguracaoContabilWithRelations) => ({
    id: record.id,
    tipoProcesso: record.tipoProcesso,
    tipoDocumentoERP: record.tipoDocumentoERP,
    ciaId: record.ciaId,
    cia: formatCia(record.cia),
    periodoDeDiferimento: record.periodoDeDiferimento,
    tipoContabilERP: record.tipoContabilERP,
    textoHeaderContabil: record.textoHeaderContabil,
    tipoDocumentoXTPG: record.tipoDocumentoXTPG,
    taxaExpiracao: record.taxaExpiracao ? record.taxaExpiracao.toNumber() : null,
    criadoPor: record.criadoPor,
    criadoPorUsuario: formatUsuario(record.criadoPorUsuario),
    criadoEm: formatDateToBrazilianTimezone(record.criadoEm),
    atualizadoPor: record.atualizadoPor,
    atualizadoPorUsuario: formatUsuario(record.atualizadoPorUsuario),
    atualizadoEm: formatDateToBrazilianTimezone(record.atualizadoEm),
    detalhes: record.configuracaoContabilDetalhes?.map(formatConfiguracaoContabilDetalhe),
});
