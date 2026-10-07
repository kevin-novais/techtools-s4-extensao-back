import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConfiguracaoContabilDetalheCreateService } from "../../../src/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheCreateService";
import { ConfiguracaoContabilDetalheUpdateService } from "../../../src/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheUpdateService";
import { ConfiguracaoContabilDetalheShowService } from "../../../src/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheShowService";
import { ConfiguracaoContabilDetalheDeleteService } from "../../../src/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheDeleteService";
import { ConfiguracaoContabilDetalheListService } from "../../../src/modules/configuracao-contabil/services/detalhes/ConfiguracaoContabilDetalheListService";
import AppError from "../../../src/util/AppError";

const { Prisma } = vi.hoisted(() => {
  class DecimalMock {
    private readonly value: number;

    constructor(value: DecimalMock | number | string) {
      this.value = value instanceof DecimalMock ? Number(value) : Number(value);
    }

    toNumber() {
      return this.value;
    }

    valueOf() {
      return this.value;
    }
  }

  return {
    Prisma: {
      Decimal: DecimalMock,
    },
  };
});

vi.mock("@prisma/client-s4-dotz", () => ({
  Prisma,
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
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
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("../../../src/util/date", () => ({
  formatDateToBrazilianTimezone: vi.fn((d: Date) => (d ? d.toISOString() : "")),
}));

import s4DotzClient from "../../../src/database/clients/s4DotzClient";

describe("ConfiguracaoContabilDetalheCreateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando configuração contábil não encontrada", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDetalheCreateService();
    const promise = service.execute({
      configuracaoContabilId: 999,
      data: {
        grupoPisCofins: "S",
        aliquotaPis: new Prisma.Decimal(1.65),
        aliquotaCofins: new Prisma.Decimal(7.6),
        contaCreditoValorProduto: "1.1.01",
        contaDebitoValorProduto: "1.1.02",
      },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil não encontrada",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 400 quando conta crédito = débito para Produto", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);

    const service = new ConfiguracaoContabilDetalheCreateService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      data: {
        grupoPisCofins: "S",
        aliquotaPis: new Prisma.Decimal(1.65),
        aliquotaCofins: new Prisma.Decimal(7.6),
        contaCreditoValorProduto: "1.1.01",
        contaDebitoValorProduto: "1.1.01",
      },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Conta de crédito não pode ser igual à conta de débito para Produto",
      statusCode: 400,
    });
  });

  it("deve criar detalhe com validarDivergencia default true", async () => {
    const detalheCriado = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: null,
      grupoPisCofins: "S",
      validarDivergencia: true,
      aliquotaPis: { toNumber: () => 1.65 },
      aliquotaCofins: { toNumber: () => 7.6 },
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.create).mockResolvedValue(detalheCriado as any);

    const service = new ConfiguracaoContabilDetalheCreateService();
    await service.execute({
      configuracaoContabilId: 1,
      data: {
        grupoPisCofins: "S",
        aliquotaPis: new Prisma.Decimal(1.65),
        aliquotaCofins: new Prisma.Decimal(7.6),
        contaCreditoValorProduto: "1.1.01",
        contaDebitoValorProduto: "1.1.02",
      },
      usuarioId: 1,
    });

    expect(s4DotzClient.configuracaoContabilDetalhe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validarDivergencia: true,
        }),
      })
    );
  });

  it("deve criar detalhe sem contaCreditoValorProduto nem contaDebitoValorProduto", async () => {
    const detalheCriado = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: null,
      grupoPisCofins: "S",
      validarDivergencia: true,
      aliquotaPis: { toNumber: () => 1.65 },
      aliquotaCofins: { toNumber: () => 7.6 },
      contaCreditoValorProduto: null,
      contaDebitoValorProduto: null,
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findFirst).mockResolvedValue(null);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.create).mockResolvedValue(detalheCriado as any);

    const service = new ConfiguracaoContabilDetalheCreateService();
    await service.execute({
      configuracaoContabilId: 1,
      data: {
        grupoPisCofins: "S",
        aliquotaPis: new Prisma.Decimal(1.65),
        aliquotaCofins: new Prisma.Decimal(7.6),
      },
      usuarioId: 1,
    });

    expect(s4DotzClient.configuracaoContabilDetalhe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contaCreditoValorProduto: null,
          contaDebitoValorProduto: null,
        }),
      })
    );
  });

  it("deve criar detalhe com validarDivergencia false quando informado", async () => {
    const detalheCriado = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: null,
      grupoPisCofins: "S",
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

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.create).mockResolvedValue(detalheCriado as any);

    const service = new ConfiguracaoContabilDetalheCreateService();
    const result = await service.execute({
      configuracaoContabilId: 1,
      data: {
        grupoPisCofins: "S",
        aliquotaPis: new Prisma.Decimal(1.65),
        aliquotaCofins: new Prisma.Decimal(7.6),
        validarDivergencia: false,
        contaCreditoValorProduto: "1.1.01",
        contaDebitoValorProduto: "1.1.02",
      },
      usuarioId: 1,
    });

    expect(s4DotzClient.configuracaoContabilDetalhe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validarDivergencia: false,
        }),
      })
    );
    expect(result.validarDivergencia).toBe(false);
  });

  it("deve criar detalhe com sucesso e retornar objeto formatado", async () => {
    const detalheCriado = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
      aliquotaPis: { toNumber: () => 1.65 },
      aliquotaCofins: { toNumber: () => 7.6 },
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.create).mockResolvedValue(detalheCriado as any);

    const service = new ConfiguracaoContabilDetalheCreateService();
    const result = await service.execute({
      configuracaoContabilId: 1,
      data: {
        codigoItem: "ITEM01",
        grupoPisCofins: "S",
        aliquotaPis: new Prisma.Decimal(1.65),
        aliquotaCofins: new Prisma.Decimal(7.6),
        contaCreditoValorProduto: "1.1.01",
        contaDebitoValorProduto: "1.1.02",
      },
      usuarioId: 1,
    });

    expect(result).toMatchObject({
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
    });
    expect(result.aliquotaPis).toBe(1.65);
    expect(result.aliquotaCofins).toBe(7.6);
  });

  it("deve criar detalhe com grupoPisCofins N sem aliquotaPis e aliquotaCofins", async () => {
    const detalheCriado = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: null,
      grupoPisCofins: "N",
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

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.create).mockResolvedValue(detalheCriado as any);

    const service = new ConfiguracaoContabilDetalheCreateService();
    const result = await service.execute({
      configuracaoContabilId: 1,
      data: {
        grupoPisCofins: "N",
        contaCreditoValorProduto: "1.1.01",
        contaDebitoValorProduto: "1.1.02",
      },
      usuarioId: 1,
    });

    expect(result).toMatchObject({
      id: 1,
      grupoPisCofins: "N",
    });
    expect(s4DotzClient.configuracaoContabilDetalhe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          grupoPisCofins: "N",
          aliquotaPis: null,
          aliquotaCofins: null,
        }),
      })
    );
  });

  it("deve lançar AppError 400 quando grupoPisCofins S sem aliquotaPis e aliquotaCofins", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);

    const service = new ConfiguracaoContabilDetalheCreateService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      data: {
        grupoPisCofins: "S",
        contaCreditoValorProduto: "1.1.01",
        contaDebitoValorProduto: "1.1.02",
      },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Quando grupoPisCofins é 'S', aliquotaPis e aliquotaCofins são obrigatórios",
      statusCode: 400,
    });
  });
});

describe("ConfiguracaoContabilDetalheUpdateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando configuração contábil não encontrada", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDetalheUpdateService();
    const promise = service.execute({
      configuracaoContabilId: 999,
      detalheId: 1,
      data: {},
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil não encontrada",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 404 quando detalhe não encontrado", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDetalheUpdateService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      detalheId: 999,
      data: {},
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Detalhe da configuração contábil não encontrado",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 400 quando detalhe não pertence à configuração", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue({
      id: 1,
      configuracaoContabilId: 2,
    } as any);

    const service = new ConfiguracaoContabilDetalheUpdateService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
      data: {},
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Detalhe não pertence à configuração informada",
      statusCode: 400,
    });
  });

  it("deve lançar AppError 400 quando conta crédito = débito após merge", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue({
      id: 1,
      configuracaoContabilId: 1,
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
    } as any);

    const service = new ConfiguracaoContabilDetalheUpdateService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
      data: {
        contaCreditoValorProduto: "1.1.02",
        contaDebitoValorProduto: "1.1.02",
      },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Conta de crédito não pode ser igual à conta de débito para Produto",
      statusCode: 400,
    });
  });

  it("deve atualizar detalhe com validarDivergencia e retornar objeto formatado", async () => {
    const detalheAtualizado = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: false,
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T13:00:00Z"),
    };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue({
      id: 1,
      configuracaoContabilId: 1,
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
    } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.update).mockResolvedValue(detalheAtualizado as any);

    const service = new ConfiguracaoContabilDetalheUpdateService();
    const result = await service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
      data: { validarDivergencia: false },
      usuarioId: 1,
    });

    expect(result).toMatchObject({
      id: 1,
      validarDivergencia: false,
    });
    expect(s4DotzClient.configuracaoContabilDetalhe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validarDivergencia: false,
        }),
      })
    );
  });

  it("deve lançar AppError 400 ao atualizar para grupoPisCofins S sem aliquotas quando detalhe atual não tem", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue({
      id: 1,
      configuracaoContabilId: 1,
      grupoPisCofins: "N",
      aliquotaPis: null,
      aliquotaCofins: null,
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
    } as any);

    const service = new ConfiguracaoContabilDetalheUpdateService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
      data: { grupoPisCofins: "S" },
      usuarioId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Quando grupoPisCofins é 'S', aliquotaPis e aliquotaCofins são obrigatórios",
      statusCode: 400,
    });
  });

  it("deve atualizar para grupoPisCofins N sem aliquotas", async () => {
    const detalheAtualizado = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "N",
      validarDivergencia: true,
      aliquotaPis: null,
      aliquotaCofins: null,
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T13:00:00Z"),
    };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue({
      id: 1,
      configuracaoContabilId: 1,
      grupoPisCofins: "S",
      aliquotaPis: { toNumber: () => 1.65 },
      aliquotaCofins: { toNumber: () => 7.6 },
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
    } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.update).mockResolvedValue(detalheAtualizado as any);

    const service = new ConfiguracaoContabilDetalheUpdateService();
    const result = await service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
      data: { grupoPisCofins: "N" },
      usuarioId: 1,
    });

    expect(result).toMatchObject({
      id: 1,
      grupoPisCofins: "N",
    });
    expect(s4DotzClient.configuracaoContabilDetalhe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          grupoPisCofins: "N",
        }),
      })
    );
  });
});

describe("ConfiguracaoContabilDetalheShowService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando configuração contábil não encontrada", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDetalheShowService();
    const promise = service.execute({
      configuracaoContabilId: 999,
      detalheId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil não encontrada",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 404 quando detalhe não encontrado", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDetalheShowService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      detalheId: 999,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Detalhe da configuração contábil não encontrado",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 400 quando detalhe não pertence à configuração", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue({
      id: 1,
      configuracaoContabilId: 2,
    } as any);

    const service = new ConfiguracaoContabilDetalheShowService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Detalhe não pertence à configuração informada",
      statusCode: 400,
    });
  });

  it("deve retornar detalhe formatado com validarDivergencia quando encontrado", async () => {
    const detalhe = {
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
      aliquotaPis: { toNumber: () => 1.65 },
      aliquotaCofins: { toNumber: () => 7.6 },
      contaCreditoValorProduto: "1.1.01",
      contaDebitoValorProduto: "1.1.02",
      criadoPor: 1,
      criadoEm: new Date("2026-03-10T12:00:00Z"),
      atualizadoPor: 1,
      atualizadoEm: new Date("2026-03-10T12:00:00Z"),
    };

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue(detalhe as any);

    const service = new ConfiguracaoContabilDetalheShowService();
    const result = await service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
    });

    expect(result).toMatchObject({
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
    });
    expect(result.aliquotaPis).toBe(1.65);
    expect(result.aliquotaCofins).toBe(7.6);
  });
});

describe("ConfiguracaoContabilDetalheDeleteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando configuração contábil não encontrada", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDetalheDeleteService();
    const promise = service.execute({
      configuracaoContabilId: 999,
      detalheId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil não encontrada",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 404 quando detalhe não encontrado", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDetalheDeleteService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      detalheId: 999,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Detalhe da configuração contábil não encontrado",
      statusCode: 404,
    });
  });

  it("deve lançar AppError 400 quando detalhe não pertence à configuração", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue({
      id: 1,
      configuracaoContabilId: 2,
    } as any);

    const service = new ConfiguracaoContabilDetalheDeleteService();
    const promise = service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Detalhe não pertence à configuração informada",
      statusCode: 400,
    });
  });

  it("deve remover detalhe com sucesso", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findUnique).mockResolvedValue({
      id: 1,
      configuracaoContabilId: 1,
    } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.delete).mockResolvedValue({} as any);

    const service = new ConfiguracaoContabilDetalheDeleteService();
    const result = await service.execute({
      configuracaoContabilId: 1,
      detalheId: 1,
    });

    expect(result).toEqual({
      message: "Detalhe da configuração contábil removido com sucesso",
    });
    expect(s4DotzClient.configuracaoContabilDetalhe.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });
});

describe("ConfiguracaoContabilDetalheListService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve lançar AppError 404 quando configuração contábil não encontrada", async () => {
    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue(null);

    const service = new ConfiguracaoContabilDetalheListService();
    const promise = service.execute({
      configuracaoContabilId: 999,
    });

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "Configuração contábil não encontrada",
      statusCode: 404,
    });
  });

  it("deve retornar detalhes com validarDivergencia e paginação", async () => {
    const detalhes = [
      {
        id: 1,
        configuracaoContabilId: 1,
        codigoItem: "ITEM01",
        grupoPisCofins: "S",
        validarDivergencia: true,
        criadoPor: 1,
        criadoEm: new Date("2026-03-10T12:00:00Z"),
        atualizadoPor: 1,
        atualizadoEm: new Date("2026-03-10T12:00:00Z"),
      },
    ];

    vi.mocked(s4DotzClient.configuracaoContabil.findUnique).mockResolvedValue({ id: 1 } as any);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.count).mockResolvedValue(3);
    vi.mocked(s4DotzClient.configuracaoContabilDetalhe.findMany).mockResolvedValue(detalhes as any);

    const service = new ConfiguracaoContabilDetalheListService();
    const result = await service.execute({
      configuracaoContabilId: 1,
      page: 1,
      limit: 2,
    });

    expect(result.detalhes).toHaveLength(1);
    expect(result.detalhes[0]).toMatchObject({
      id: 1,
      configuracaoContabilId: 1,
      codigoItem: "ITEM01",
      grupoPisCofins: "S",
      validarDivergencia: true,
    });
    expect(result.pagination).toMatchObject({
      currentPage: 1,
      totalItems: 3,
      totalPages: 2,
      itemsPerPage: 2,
    });
  });
});
