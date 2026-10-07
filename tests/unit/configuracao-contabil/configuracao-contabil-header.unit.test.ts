import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConfiguracaoContabilCreateService } from "../../../src/modules/configuracao-contabil/services/ConfiguracaoContabilCreateService";
import { ConfiguracaoContabilListService } from "../../../src/modules/configuracao-contabil/services/ConfiguracaoContabilListService";
import { ConfiguracaoContabilShowService } from "../../../src/modules/configuracao-contabil/services/ConfiguracaoContabilShowService";
import { ConfiguracaoContabilUpdateService } from "../../../src/modules/configuracao-contabil/services/ConfiguracaoContabilUpdateService";
import { ConfiguracaoContabilDeleteService } from "../../../src/modules/configuracao-contabil/services/ConfiguracaoContabilDeleteService";
import AppError from "../../../src/util/AppError";

vi.mock("@/database/clients/s4DotzClient", () => ({
  default: {
    cia: { findUnique: vi.fn() },
    configuracaoContabil: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    configuracaoContabilDetalhe: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/util/date", () => ({
  formatDateToBrazilianTimezone: vi.fn((d: Date) => (d ? d.toISOString() : "")),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("ConfiguracaoContabilCreateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando CIA não encontrada", async () => {
    vi.mocked(s4DotzClient.cia.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilCreateService();
    const promise = service.execute({
      data: {
        tipoDocumentoERP: "TP_ROM",
        ciaId: 999,
        tipoContabilERP: "AP",
      },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "CIA não encontrada",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 400 quando configuração já existe para CIA e tipoDocumentoERP", async () => {
    vi.mocked(s4DotzClient.cia.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({
      id: 1,
      ciaId: 1,
      tipoDocumentoERP: "TP_ROM",
    } as any);

    const service = new ConfiguracaoContabilCreateService();
    const promise = service.execute({
      data: {
        tipoDocumentoERP: "TP_ROM",
        ciaId: 1,
        tipoContabilERP: "AP",
      },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil já cadastrada para esta CIA e tipoProcesso",
      statusCode: 400,
    });
  });

  it("deve lançar AppError 400 ao definir periodoDeDiferimento em tipo não-DR", async () => {
    vi.mocked(s4DotzClient.cia.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilCreateService();
    await expect(
      service.execute({
        data: { tipoDocumentoERP: "TP_ROM", ciaId: 1, tipoContabilERP: "AP", periodoDeDiferimento: 12 },
        usuarioId: 1,
      })
    ).rejects.toMatchObject({
      message: "Período de diferimento é permitido apenas para o tipo DR (Venda de Pontos)",
      statusCode: 400,
    });
  });

  it("deve criar configuração DR com periodoDeDiferimento = 0 com sucesso", async () => {
    const configCriada = {
      id: 2, tipoDocumentoERP: "DR", ciaId: 1, periodoDeDiferimento: 0,
      tipoContabilERP: "AR", textoHeaderContabil: null,
      criadoPor: 1, criadoEm: new Date(), atualizadoPor: 1, atualizadoEm: new Date(),
    };
    vi.mocked(s4DotzClient.cia.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);
    vi.mocked(s4DotzClient.configuracaoContabil.create).mockResolvedValue(configCriada as any);

    const service = new ConfiguracaoContabilCreateService();
    const result = await service.execute({
      data: { tipoProcesso: "DR", tipoDocumentoERP: "DR", ciaId: 1, tipoContabilERP: "AR", periodoDeDiferimento: 0 },
      usuarioId: 1,
    });

    expect(result).toMatchObject({ id: 2, periodoDeDiferimento: 0 });
    expect(s4DotzClient.configuracaoContabil.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ periodoDeDiferimento: 0 }) })
    );
  });

  it("deve criar configuração não-DR sem periodoDeDiferimento (null) com sucesso", async () => {
    const configCriada = {
      id: 3, tipoDocumentoERP: "RD", ciaId: 1, periodoDeDiferimento: null,
      tipoContabilERP: "GL", textoHeaderContabil: null,
      criadoPor: 1, criadoEm: new Date(), atualizadoPor: 1, atualizadoEm: new Date(),
    };
    vi.mocked(s4DotzClient.cia.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);
    vi.mocked(s4DotzClient.configuracaoContabil.create).mockResolvedValue(configCriada as any);

    const service = new ConfiguracaoContabilCreateService();
    const result = await service.execute({
      data: { tipoDocumentoERP: "RD", ciaId: 1, tipoContabilERP: "GL" },
      usuarioId: 1,
    });

    expect(result).toMatchObject({ id: 3, periodoDeDiferimento: null });
  });

  it("deve criar configuração com sucesso e retornar objeto formatado", async () => {
    const configCriada = {
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

    vi.mocked(s4DotzClient.cia.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);
    vi.mocked(s4DotzClient.configuracaoContabil.create).mockResolvedValue(configCriada as any);

    const service = new ConfiguracaoContabilCreateService();
    const result = await service.execute({
      data: {
        tipoDocumentoERP: "TP_ROM",
        ciaId: 1,
        tipoContabilERP: "AP",
      },
      usuarioId: 1,
    });

    expect(result).toMatchObject({
      id: 1,
      tipoDocumentoERP: "TP_ROM",
      ciaId: 1,
      tipoContabilERP: "AP",
    });
    expect(s4DotzClient.configuracaoContabil.create).toHaveBeenCalledOnce();
  });
});

describe("ConfiguracaoContabilListService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar lista com paginação correta", async () => {
    const configs = [
      {
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
      },
      {
        id: 2,
        tipoDocumentoERP: "TP_POS",
        ciaId: 1,
        periodoDeDiferimento: null,
        tipoContabilERP: "AP",
        textoHeaderContabil: null,
        criadoPor: 1,
        criadoEm: new Date("2026-03-10T12:00:00Z"),
        atualizadoPor: 1,
        atualizadoEm: new Date("2026-03-10T12:00:00Z"),
      },
    ];

    vi.mocked(s4DotzClient.configuracaoContabil.count).mockResolvedValue(5);
    vi.mocked(s4DotzClient.configuracaoContabil.findMany).mockResolvedValue(configs as any);

    const service = new ConfiguracaoContabilListService();
    const result = await service.execute({ page: 1, limit: 2 });

    expect(result.configuracoes).toHaveLength(2);
    expect(result.pagination).toMatchObject({
      currentPage: 1,
      totalItems: 5,
      totalPages: 3,
      itemsPerPage: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });
});

describe("ConfiguracaoContabilShowService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando configuração não encontrada", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilShowService();
    const promise = service.execute(999);

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil não encontrada",
      statusCode: 404,
    });
  });

  it("deve retornar configuração formatada com detalhes quando encontrada", async () => {
    const config = {
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
      cia: { id: 1, nome: "CIA Teste" },
      criadoPorUsuario: { id: 1, nome: "Admin", email: "admin@test.com" },
      atualizadoPorUsuario: { id: 1, nome: "Admin", email: "admin@test.com" },
      configuracaoContabilDetalhes: [],
    };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(config as any);

    const service = new ConfiguracaoContabilShowService();
    const result = await service.execute(1);

    expect(result).toMatchObject({
      id: 1,
      tipoDocumentoERP: "TP_ROM",
      ciaId: 1,
      tipoContabilERP: "AP",
    });
    expect(result.detalhes).toEqual([]);
  });
});

describe("ConfiguracaoContabilUpdateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando configuração não encontrada", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilUpdateService();
    const promise = service.execute({
      id: 999,
      data: { tipoDocumentoERP: "AP" },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil não encontrada",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 404 quando CIA não encontrada ao alterar ciaId", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique)
      .mockResolvedValueOnce({ id: 1, ciaId: 1, tipoDocumentoERP: "TP_ROM" } as any)
      .mockResolvedValueOnce(null);

    vi.mocked(s4DotzClient.cia.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilUpdateService();
    const promise = service.execute({
      id: 1,
      data: { ciaId: 999 },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "CIA não encontrada",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 400 quando já existe configuração com ciaId e tipoDocumentoERP", async () => {
    const configAtual = { id: 1, ciaId: 1, tipoDocumentoERP: "TP_ROM", tipoContabilERP: "AP" };
    const conflito = { id: 2, ciaId: 2, tipoDocumentoERP: "TP_ROM", tipoContabilERP: "AP" };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique)
      .mockResolvedValueOnce(configAtual as any)
      .mockResolvedValueOnce({ id: 2 } as any);

    vi.mocked(s4DotzClient.cia.findUnique).mockResolvedValue({ id: 2 } as any);

    const service = new ConfiguracaoContabilUpdateService();
    const promise = service.execute({
      id: 1,
      data: { ciaId: 2, tipoDocumentoERP: "TP_ROM" },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Já existe uma configuração contábil com esta CIA e tipoProcesso",
      statusCode: 400,
    });
  });

  it("deve lançar AppError 400 ao definir periodoDeDiferimento em tipo não-DR existente", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({
      id: 1, ciaId: 1, tipoDocumentoERP: "TP_ROM", tipoContabilERP: "AP",
      periodoDeDiferimento: null,
    } as any);

    const service = new ConfiguracaoContabilUpdateService();
    await expect(
      service.execute({ id: 1, data: { periodoDeDiferimento: 12 }, usuarioId: 1 })
    ).rejects.toMatchObject({
      message: "Período de diferimento é permitido apenas para o tipo DR (Venda de Pontos)",
      statusCode: 400,
    });
  });

  it("deve limpar periodoDeDiferimento automaticamente ao mudar tipo de DR para não-DR", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({
      id: 1, ciaId: 1, tipoProcesso: "DR", tipoDocumentoERP: "DR", tipoContabilERP: "AR",
      periodoDeDiferimento: 12,
    } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.update).mockResolvedValue({
      id: 1, ciaId: 1, tipoProcesso: "RD", tipoDocumentoERP: "RD", tipoContabilERP: "GL",
      periodoDeDiferimento: null, textoHeaderContabil: null,
      criadoPor: 1, criadoEm: new Date(), atualizadoPor: 1, atualizadoEm: new Date(),
    } as any);

    const service = new ConfiguracaoContabilUpdateService();
    await service.execute({ id: 1, data: { tipoProcesso: "RD", tipoDocumentoERP: "RD", tipoContabilERP: "GL" }, usuarioId: 1 });

    expect(s4DotzClient.configuracaoContabil.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ periodoDeDiferimento: null }),
      })
    );
  });

  it("deve atualizar periodoDeDiferimento = 0 em configuração DR com sucesso", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({
      id: 1, ciaId: 1, tipoProcesso: "DR", tipoDocumentoERP: "DR", tipoContabilERP: "AR",
      periodoDeDiferimento: 12,
    } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.update).mockResolvedValue({
      id: 1, ciaId: 1, tipoDocumentoERP: "DR", tipoContabilERP: "AR",
      periodoDeDiferimento: 0, textoHeaderContabil: null,
      criadoPor: 1, criadoEm: new Date(), atualizadoPor: 1, atualizadoEm: new Date(),
    } as any);

    const service = new ConfiguracaoContabilUpdateService();
    await service.execute({ id: 1, data: { periodoDeDiferimento: 0 }, usuarioId: 1 });

    expect(s4DotzClient.configuracaoContabil.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ periodoDeDiferimento: 0 }),
      })
    );
  });

  it("deve atualizar configuração com sucesso", async () => {
    const configAtualizada = {
      id: 1,
      tipoDocumentoERP: "TP_ROM",
      ciaId: 1,
      periodoDeDiferimento: null,
      tipoContabilERP: "AP",
      textoHeaderContabil: "Texto atualizado",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T13:00:00Z"),
    };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({
      id: 1,
      ciaId: 1,
      tipoDocumentoERP: "TP_ROM",
      tipoContabilERP: "AP",
    } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.update).mockResolvedValue(configAtualizada as any);

    const service = new ConfiguracaoContabilUpdateService();
    const result = await service.execute({
      id: 1,
      data: { textoHeaderContabil: "Texto atualizado" },
      usuarioId: 1,
    });

    expect(result).toMatchObject({
      id: 1,
      textoHeaderContabil: "Texto atualizado",
    });
    expect(s4DotzClient.configuracaoContabil.update).toHaveBeenCalledOnce();
  });
});

describe("ConfiguracaoContabilDeleteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando configuração não encontrada", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDeleteService();
    const promise = service.execute(999);

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil não encontrada",
      statusCode: 404,
    });
  });

  it("deve remover configuração com sucesso", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({
      id: 1,
      ciaId: 1,
      tipoDocumentoERP: "TP_ROM",
    } as any);
    vi.mocked(s4DotzClient.configuracaoContabil.delete).mockResolvedValue({} as any);

    const service = new ConfiguracaoContabilDeleteService();
    const result = await service.execute(1);

    expect(result).toEqual({
      message: "Configuração contábil removida com sucesso",
    });
    expect(s4DotzClient.configuracaoContabil.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
