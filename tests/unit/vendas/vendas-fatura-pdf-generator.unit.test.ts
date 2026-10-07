import fs from "node:fs";
import path from "node:path";
import { VendasFaturaPDFGenerator, VendasPDFData } from "@/modules/vendas/utils/relatorio/VendasFaturaPDFGenerator";

const PREVIEW_PATH = path.resolve(process.cwd(), "tmp", "fatura-vendas-preview.pdf");

const previewData: VendasPDFData = {
    numeroDocumento: "0000009.826",
    dataEmissao: "02/02/2026",
    dataVencimento: "22/02/2026",
    dataFaturamento: "JANEIRO/2026",
    numeroFaturaParceiro: "942359-0109",
    isPagamentoBoleto: true,
    valorTotal: 1176.00,
    cia: {
        nome: "CBSM - Companhia Brasileira de Serviços de Marketing SA.",
        cpfCnpj: "12345678000190",
        ie: "Isento",
        endereco: "Avenida das Nacoes Unidas, 12995, 16° Andar- Cj. 1601",
        bairro: "Itaim Bibi",
        municipio: "São Paulo",
        uf: "SP",
        cep: "04578910",
        telefone: "01133774567",
        email: "contasareceber@dotz.com.br",
    },
    cliente: {
        cardName: "BANESTES S.A. - BANCO DO ESTADO DO ESPÍRITO SANTO",
        cnpj: "98765432000110",
        ie: "Isento",
        endereco: "Rua de Exemplo, 987 - Conjunto 12",
        municipio: "Belo Horizonte - MG",
        cep: "30110020",
        email: "financeiro@cliente-exemplo.com.br,financeiro2@cliente-exemplo.com.b",
        telefone: "3133334444",
    },
    informacoesAdicionais:
        "Adicionais Referência: campanha promocional de inverno.",
    detalhes: [
        {
            descricaoProduto: "Créditos Dotz",
            quantidadePontos: 1000.00,
            precoUnitario: 0.0100,
            valorVenda: 10000.00,
        },
        {
            descricaoProduto: "Créditos Dotz - Campanha promocional",
            quantidadePontos: 500.00,
            precoUnitario: 0.0105,
            valorVenda: 5250.00,
        },
        {
            descricaoProduto: "Ajuste de arredondamento",
            quantidadePontos: 1,
            precoUnitario: 0.7500,
            valorVenda: 0.75,
        },
    ],
};

describe("VendasFaturaPDFGenerator - preview visual", () => {
    it("gera uma fatura PDF real para conferência do layout", async () => {
        const pdfBytes = await new VendasFaturaPDFGenerator().generate(previewData);

        await fs.promises.mkdir(path.dirname(PREVIEW_PATH), { recursive: true });
        await fs.promises.writeFile(PREVIEW_PATH, pdfBytes);

        expect(Buffer.from(pdfBytes.subarray(0, 4)).toString("ascii")).toBe("%PDF");
        await expect(fs.promises.stat(PREVIEW_PATH)).resolves.toMatchObject({
            size: pdfBytes.length,
        });

        console.info(`Preview da fatura gerado em: ${PREVIEW_PATH}`);
    });
});
