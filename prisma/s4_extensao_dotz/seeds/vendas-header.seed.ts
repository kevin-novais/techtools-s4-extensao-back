import { PrismaClient } from "@prisma/client-s4-dotz";
import { faker } from "@faker-js/faker";

const STATUS_OPTIONS = ["PENDENTE", "AGUARDANDO", "INTEG_SAP"];

function buildVendaHeaderData(ciaIdSAP: string) {
  const dataEmissao = faker.date.recent({ days: 60 });
  const dataVencimento = new Date(dataEmissao);
  dataVencimento.setDate(dataVencimento.getDate() + 30);

  const status = faker.helpers.arrayElement(STATUS_OPTIONS);
  const isIntegrado = status === "INTEG_SAP";

  return {
    ciaIdSAP,
    status,
    tipoCadastro: "MANUAL",
    codigoClienteAnalyzer: faker.string.alphanumeric(10).toUpperCase(),
    codigoClienteSAP: `C${faker.string.numeric(6)}`,
    numeroDocumentoAnalyzer: faker.string.numeric(8),
    infoReferenciaAnalyzer: `PERIODO DE FATURAMENTO : ${faker.date.month().toUpperCase()}/${faker.number.int({ min: 2025, max: 2026 })}.`,
    valorTotalVendas: Number.parseFloat(
      faker.finance.amount({ min: 500, max: 50000, dec: 2 })
    ),
    codigoDocumentoERP: isIntegrado ? faker.string.numeric(10) : null,
    dataIntegracao: isIntegrado ? faker.date.recent({ days: 30 }) : null,
    pathArquivoFaturaDetalhadaAnalyzer: null,
    pathArquivoRelatorioAnalitico: null,
    dataEmissao,
    dataLancamentoContabil: dataEmissao,
    dataVencimento,
  };
}

export async function seedVendasHeader(prisma: PrismaClient) {
  const existingCount = await prisma.vendasHeader.count();

  if (existingCount > 0) {
    console.debug(
      `Já existem ${existingCount} vendas headers. Seed não executado.`
    );
    return;
  }

  const cias = await prisma.cia.findMany({
    where: { deletadoEm: null },
    select: { id: true, ciaIdSAP: true },
  });

  if (cias.length === 0) {
    console.debug("Nenhuma CIA encontrada. Execute a seed de CIAs primeiro.");
    return;
  }

  let createdCount = 0;

  for (const cia of cias) {
    const ciaIdSAP = cia.ciaIdSAP?.trim() || String(cia.id);
    const qtdHeaders = faker.number.int({ min: 3, max: 5 });

    for (let i = 0; i < qtdHeaders; i++) {
      try {
        await prisma.vendasHeader.create({
          data: buildVendaHeaderData(ciaIdSAP),
        });
        createdCount++;
      } catch (error) {
        console.debug(
          `Erro ao criar vendas header para CIA ${cia.id}:`,
          error
        );
      }
    }
  }

  console.debug(`${createdCount} vendas headers criados com sucesso.`);
}
