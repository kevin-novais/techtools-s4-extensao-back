import { PrismaClient, Prisma } from "@prisma/client-s4-dotz";
import { faker } from "@faker-js/faker";
import { GrupoPisConfinsTypes } from "../../../src/@types/ConfiguracaoContabil/GrupoPisConfinsTypes";

/**
 * Gera um ID de conta contábil SAP realista
 * @param tipo - Tipo da conta (ativo, passivo, receita, despesa, aliquota)
 * @returns String numérica representando o ID da conta SAP
 */
function gerarIdContaSAP(tipo: 'ativo' | 'passivo' | 'receita' | 'despesa' | 'aliquota'): string {
  const prefixos = {
    ativo: '1',
    passivo: '2',
    receita: '3',
    despesa: '4',
    aliquota: faker.helpers.arrayElement(['165', '065', '100', '760', '300', '400'])
  };

  const prefixo = prefixos[tipo];
  const tamanhoResto = tipo === 'aliquota' ? 6 : 8;
  const resto = faker.string.numeric(tamanhoResto);

  return prefixo + resto;
}

/**
 * Gera um código de item no formato ITEM + 6 dígitos
 */
function gerarCodigoItem(): string {
  return 'ITEM' + faker.string.numeric(6);
}

/**
 * Gera um valor decimal de alíquota PIS/COFINS realista
 * Valores comuns: PIS (0.65%, 1.65%), COFINS (3%, 7.6%)
 * @returns Prisma.Decimal com valor entre 0 e 100 com até 4 casas decimais
 */
function gerarAliquotaPisCofins(): Prisma.Decimal {
  // Valores realistas de alíquotas PIS/COFINS no Brasil
  const aliquotasComuns = [0.65, 1.65, 3, 7.6, 1.5, 2.5, 4.5, 5];

  // 70% de chance de usar uma alíquota comum, 30% de gerar aleatória
  if (faker.datatype.boolean({ probability: 0.7 })) {
    const aliquota = faker.helpers.arrayElement(aliquotasComuns);
    // Adiciona variação de até 0.5% para tornar mais realista
    const variacao = faker.number.float({ min: -0.5, max: 0.5, fractionDigits: 4 });
    const valorFinal = Math.max(0, Math.min(100, aliquota + variacao));
    return new Prisma.Decimal(valorFinal.toFixed(4));
  }

  // Gera valor aleatório entre 0 e 100 com até 4 casas decimais
  const valor = faker.number.float({ min: 0, max: 100, fractionDigits: 4 });
  return new Prisma.Decimal(valor.toFixed(4));
}

export async function seedConfiguracaoContabilDetalhe(prisma: PrismaClient) {
  const existingDetalhesCount = await prisma.configuracaoContabilDetalhe.count();

  if (existingDetalhesCount > 0) {
    console.debug(
      `Já existem ${existingDetalhesCount} detalhes de configurações contábeis. Seed não executado.`
    );
    return;
  }

  const configuracoes = await prisma.configuracaoContabil.findMany();

  if (configuracoes.length === 0) {
    console.debug("Nenhuma configuração contábil encontrada. Execute a seed de configurações primeiro.");
    return;
  }

  const gruposPisCofins = Object.values(GrupoPisConfinsTypes);
  let createdCount = 0;

  // Criar 2-5 detalhes para cada configuração
  for (const configuracao of configuracoes) {
    const numDetalhes = faker.number.int({ min: 2, max: 5 });
    // Rastrear combinações únicas de grupoPisCofins + codigoItem para esta configuração
    const combinacoesUsadas = new Set<string>();

    for (let i = 0; i < numDetalhes; i++) {
      try {
        let grupoPisCofins: string;
        let codigoItem: string | null;
        let chaveUnica: string;
        let tentativas = 0;
        const maxTentativas = 10;

        // Garantir combinação única de grupoPisCofins + codigoItem
        do {
          grupoPisCofins = faker.helpers.arrayElement(gruposPisCofins);
          // Código item: 50% das vezes tem valor, 50% é null
          codigoItem = faker.datatype.boolean() ? gerarCodigoItem() : null;
          chaveUnica = `${grupoPisCofins}|${codigoItem ?? 'NULL'}`;
          tentativas++;
        } while (combinacoesUsadas.has(chaveUnica) && tentativas < maxTentativas);

        // Se não conseguiu gerar combinação única, pula este detalhe
        if (combinacoesUsadas.has(chaveUnica)) {
          continue;
        }

        combinacoesUsadas.add(chaveUnica);

        // Se grupoPisCofins === "S", preencher alíquotas e contas PIS/COFINS
        const aliquotaPis = grupoPisCofins === GrupoPisConfinsTypes.S
          ? gerarAliquotaPisCofins()
          : null;
        const aliquotaCofins = grupoPisCofins === GrupoPisConfinsTypes.S
          ? gerarAliquotaPisCofins()
          : null;

        const contaCreditoPis = grupoPisCofins === GrupoPisConfinsTypes.S
          ? gerarIdContaSAP('ativo')
          : null;
        const contaDebitoPis = grupoPisCofins === GrupoPisConfinsTypes.S
          ? gerarIdContaSAP('passivo')
          : null;

        const contaCreditoCofins = grupoPisCofins === GrupoPisConfinsTypes.S
          ? gerarIdContaSAP('ativo')
          : null;
        const contaDebitoCofins = grupoPisCofins === GrupoPisConfinsTypes.S
          ? gerarIdContaSAP('passivo')
          : null;

        // Contas de valores de produto (ambas opcionais)
        const contaCreditoValorProduto = faker.datatype.boolean({ probability: 0.7 })
          ? gerarIdContaSAP('receita')
          : null;
        const contaDebitoValorProduto = faker.datatype.boolean({ probability: 0.7 })
          ? gerarIdContaSAP('despesa')
          : null;

        // Outras contas (70% de probabilidade de preencher)
        const contaCreditoValorFrete = faker.datatype.boolean({ probability: 0.7 })
          ? gerarIdContaSAP('receita')
          : null;
        const contaDebitoValorFrete = faker.datatype.boolean({ probability: 0.7 })
          ? gerarIdContaSAP('despesa')
          : null;

        const contaCreditoValorCombo = faker.datatype.boolean({ probability: 0.7 })
          ? gerarIdContaSAP('receita')
          : null;
        const contaDebitoValorCombo = faker.datatype.boolean({ probability: 0.7 })
          ? gerarIdContaSAP('despesa')
          : null;

        // Contas menos comuns (50% de probabilidade)
        const contaCreditoValorIs = faker.datatype.boolean({ probability: 0.5 })
          ? gerarIdContaSAP('receita')
          : null;
        const contaDebitoValorIs = faker.datatype.boolean({ probability: 0.5 })
          ? gerarIdContaSAP('despesa')
          : null;

        const contaCreditoValorCbs = faker.datatype.boolean({ probability: 0.5 })
          ? gerarIdContaSAP('receita')
          : null;
        const contaDebitoValorCbs = faker.datatype.boolean({ probability: 0.5 })
          ? gerarIdContaSAP('despesa')
          : null;

        const contaCreditoValorIbsUf = faker.datatype.boolean({ probability: 0.5 })
          ? gerarIdContaSAP('receita')
          : null;
        const contaDebitoValorIbsUf = faker.datatype.boolean({ probability: 0.5 })
          ? gerarIdContaSAP('despesa')
          : null;

        const contaCreditoValorIbsMunicipal = faker.datatype.boolean({ probability: 0.5 })
          ? gerarIdContaSAP('receita')
          : null;
        const contaDebitoValorIbsMunicipal = faker.datatype.boolean({ probability: 0.5 })
          ? gerarIdContaSAP('despesa')
          : null;

        await prisma.configuracaoContabilDetalhe.create({
          data: {
            configuracaoContabilId: configuracao.id,
            codigoItem,
            grupoPisCofins,
            aliquotaPis,
            aliquotaCofins,
            contaCreditoPis,
            contaDebitoPis,
            contaCreditoCofins,
            contaDebitoCofins,
            contaCreditoValorProduto,
            contaDebitoValorProduto,
            contaCreditoValorFrete,
            contaDebitoValorFrete,
            contaCreditoValorCombo,
            contaDebitoValorCombo,
            contaCreditoValorIs,
            contaDebitoValorIs,
            contaCreditoValorCbs,
            contaDebitoValorCbs,
            contaCreditoValorIbsUf,
            contaDebitoValorIbsUf,
            contaCreditoValorIbsMunicipal,
            contaDebitoValorIbsMunicipal,
            criadoPor: 1,
            criadoEm: new Date(),
            atualizadoPor: 1,
            atualizadoEm: new Date(),
          },
        });

        createdCount++;
      } catch (error) {
        console.debug(
          `Erro ao criar detalhe ${i + 1} para configuração ${configuracao.id}:`,
          error
        );
      }
    }
  }

  console.debug(
    `${createdCount} detalhes de configurações contábeis criados com sucesso.`
  );
}

