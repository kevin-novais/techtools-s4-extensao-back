import { PrismaClient } from "@prisma/client-s4-dotz";
import { faker } from "@faker-js/faker";

export async function seedVendasDetalhe(prisma: PrismaClient) {
  const existingCount = await prisma.vendasDetalhe.count();

  if (existingCount > 0) {
    console.debug(
      `Já existem ${existingCount} vendas detalhes. Seed não executado.`
    );
    return;
  }

  const headers = await prisma.vendasHeader.findMany();

  if (headers.length === 0) {
    console.debug(
      "Nenhum vendas header encontrado. Execute a seed de VendasHeader primeiro."
    );
    return;
  }

  let createdCount = 0;

  for (const header of headers) {
    const qtdDetalhes = faker.number.int({ min: 2, max: 4 });

    for (let i = 1; i <= qtdDetalhes; i++) {
      try {
        const quantidadePontos = faker.number.int({ min: 1000, max: 100000 });
        const precoUnitario = Number.parseFloat(
          faker.finance.amount({ min: 0.01, max: 0.05, dec: 4 })
        );
        const valorVenda = Number.parseFloat(
          (quantidadePontos * precoUnitario).toFixed(2)
        );
        const custoPontos = Number.parseFloat(
          (quantidadePontos * precoUnitario * 0.8).toFixed(6)
        );

        await prisma.vendasDetalhe.create({
          data: {
            vendasHeaderId: header.id,
            itemDocumento: i,
            codigoProdutoDotz: `DOTZ${faker.string.numeric(6)}`,
            centroLucro: faker.string.alphanumeric(6).toUpperCase(),
            quantidadePontos,
            valorVenda,
            precoUnitario,
            custoPontos,
          },
        });

        createdCount++;
      } catch (error) {
        console.debug(
          `Erro ao criar vendas detalhe para header ${header.id}:`,
          error
        );
      }
    }
  }

  console.debug(`${createdCount} vendas detalhes criados com sucesso.`);
}
