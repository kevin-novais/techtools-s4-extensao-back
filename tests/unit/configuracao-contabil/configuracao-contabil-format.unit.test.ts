import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  formatConfiguracaoContabil,
  formatConfiguracaoContabilDetalhe,
} from "../../../src/modules/configuracao-contabil/utils/formatConfiguracaoContabil";

vi.mock("@/util/date", () => ({
  formatDateToBrazilianTimezone: vi.fn((d: Date) => (d ? d.toISOString() : "")),
}));

describe("formatConfiguracaoContabilDetalhe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar objeto com id, codigoItem, grupoPisCofins, validarDivergencia e contas", () => {
    const record = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
      aliquotaPis: null,
      aliquotaCofins: null,
      contaCreditoPis: "1.1.01",
      contaDebitoPis: "1.1.02",
      contaCreditoCofins: "1.1.03",
      contaDebitoCofins: "1.1.04",
      contaCreditoValorProduto: "1.1.05",
      contaDebitoValorProduto: "1.1.06",
      contaCreditoValorFrete: null,
      contaDebitoValorFrete: null,
      contaCreditoValorCombo: null,
      contaDebitoValorCombo: null,
      contaCreditoValorIs: null,
      contaDebitoValorIs: null,
      contaCreditoValorCbs: null,
      contaDebitoValorCbs: null,
      contaCreditoValorIbsUf: null,
      contaDebitoValorIbsUf: null,
      contaCreditoValorIbsMunicipal: null,
      contaDebitoValorIbsMunicipal: null,
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    const result = formatConfiguracaoContabilDetalhe(record as any);

    expect(result).toMatchObject({
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
      contaCreditoPis: "1.1.01",
      contaDebitoPis: "1.1.02",
      contaCreditoCofins: "1.1.03",
      contaDebitoCofins: "1.1.04",
      contaCreditoValorProduto: "1.1.05",
      contaDebitoValorProduto: "1.1.06",
    });
    expect(result.aliquotaPis).toBeNull();
    expect(result.aliquotaCofins).toBeNull();
    expect(result.criadoEm).toBe("2026-03-10T12:00:00.000Z");
    expect(result.atualizadoEm).toBe("2026-03-10T12:00:00.000Z");
  });

  it("deve converter aliquotaPis e aliquotaCofins Decimal para número", () => {
    const record = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: null,
      grupoPisCofins: "N",
      validarDivergencia: false,
      aliquotaPis: { toNumber: () => 1.65 },
      aliquotaCofins: { toNumber: () => 7.6 },
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    const result = formatConfiguracaoContabilDetalhe(record as any);

    expect(result.aliquotaPis).toBe(1.65);
    expect(result.aliquotaCofins).toBe(7.6);
  });

  it("deve formatar criadoPorUsuario e atualizadoPorUsuario quando presentes", () => {
    const record = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: null,
      grupoPisCofins: "S",
      validarDivergencia: true,
      aliquotaPis: null,
      aliquotaCofins: null,
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
      criadoPor: 1,
      criadoPorUsuario: { id: 1, nome: "Admin", email: "admin@test.com" },
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoPorUsuario: { id: 1, nome: "Admin", email: "admin@test.com" },
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    const result = formatConfiguracaoContabilDetalhe(record as any);

    expect(result.criadoPorUsuario).toEqual({
      id: 1,
      nome: "Admin",
      email: "admin@test.com",
    });
    expect(result.atualizadoPorUsuario).toEqual({
      id: 1,
      nome: "Admin",
      email: "admin@test.com",
    });
  });
});

describe("formatConfiguracaoContabil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar objeto com id, tipoDocumentoERP, ciaId e detalhes mapeados", () => {
    const detalhe = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
      aliquotaPis: null,
      aliquotaCofins: null,
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    const record = {
      id: 1,
      tipoDocumentoERP: "TP_ROM",
      ciaId: 1,
      periodoDeDiferimento: 12,
      tipoContabilERP: "AP",
      textoHeaderContabil: "Texto",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
      cia: { id: 1, nome: "CIA Teste" },
      criadoPorUsuario: { id: 1, nome: "Admin", email: "admin@test.com" },
      atualizadoPorUsuario: { id: 1, nome: "Admin", email: "admin@test.com" },
      configuracaoContabilDetalhes: [detalhe],
    };

    const result = formatConfiguracaoContabil(record as any);

    expect(result).toMatchObject({
      id: 1,
      tipoDocumentoERP: "TP_ROM",
      ciaId: 1,
      periodoDeDiferimento: 12,
      tipoContabilERP: "AP",
      textoHeaderContabil: "Texto",
    });
    expect(result.cia).toEqual({ id: 1, nome: "CIA Teste" });
    expect(result.detalhes).toHaveLength(1);
    expect(result.detalhes![0]).toMatchObject({
      id: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
    });
  });

  it("deve retornar detalhes vazio quando configuracaoContabilDetalhes não existe", () => {
    const record = {
      id: 1,
      tipoDocumentoERP: "TP_ROM",
      ciaId: 1,
      periodoDeDiferimento: null,
      tipoContabilERP: "AP",
      textoHeaderContabil: null,
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    const result = formatConfiguracaoContabil(record as any);

    expect(result.detalhes).toBeUndefined();
  });

  it("deve retornar detalhes array vazio quando configuracaoContabilDetalhes é array vazio", () => {
    const record = {
      id: 1,
      tipoDocumentoERP: "TP_ROM",
      ciaId: 1,
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
      configuracaoContabilDetalhes: [],
    };

    const result = formatConfiguracaoContabil(record as any);

    expect(result.detalhes).toEqual([]);
  });
});
