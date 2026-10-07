import { formatDateToBrazilianDate } from '@/util/date';
import { formatCep } from '@/util/formatters/cep';
import { formatCurrency } from '@/util/formatters/currency';
import { formatCpfCnpj } from '@/util/formatters/documentFormatter';
import { numberFormatter } from '@/util/formatters/numberFormatter';
import log from '@/util/logger';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from 'pdf-lib';

interface CiaData {
    nome: string;
    cpfCnpj: string | null;
    ie: string | null;
    endereco: string | null;
    bairro: string | null;
    municipio: string | null;
    uf: string | null;
    cep: string | null;
    telefone: string | null;
    email: string | null;
}

interface ClienteData {
    cardName: string | null;
    cnpj: string | null;
    ie: string | null;
    endereco: string | null;
    municipio: string | null;
    cep: string | null;
    email: string | null;
    telefone: string | null;
}

interface DetalheData {
    descricaoProduto: string | null;
    codigoProdutoDotz: string;
    quantidadePontos: number;
    precoUnitario: number;
    valorVenda: number;
}

export interface VendasPDFData {
    numeroDocumento: string;
    numeroFaturaParceiro: string;
    dataEmissao: string;
    dataVencimento: string;
    dataFaturamento: string;
    isPagamentoBoleto: boolean;
    valorTotal: number;
    cia: CiaData;
    cliente: ClienteData;
    informacoesAdicionais: string;
    detalhes: DetalheData[];
}

export class VendasFaturaPDFGenerator {
    private readonly PAGE_WIDTH = 595; // A4 portrait width
    private readonly PAGE_HEIGHT = 842; // A4 portrait height
    private readonly MARGIN_TOP = 40;
    private readonly MARGIN_LEFT = 10;
    
    private readonly TITLE_FONT_SIZE = 16;

    private readonly TEXT_FONT_SIZE = 10;
    private readonly TEXT_FONT_COLOR = rgb(0, 0, 0);
    private readonly LINE_HEIGHT = 12;

    // Cores do tema Dotz
    private readonly BORDER_COLOR = rgb(0, 0, 0);

    async generate(data: VendasPDFData): Promise<Uint8Array> {
        const pdfDoc = await PDFDocument.create();
        const { default: fontkit } = await import('@pdf-lib/fontkit');
        pdfDoc.registerFontkit(fontkit);

        const [regularFontBytes, boldFontBytes] = await Promise.all([
            this.fetchFont('LiberationSans-Regular.ttf'),
            this.fetchFont('LiberationSans-Bold.ttf'),
        ]);
        const normalFont = await pdfDoc.embedFont(regularFontBytes, { subset: true });
        const boldFont = await pdfDoc.embedFont(boldFontBytes, { subset: true });

        let logoImage: PDFImage | null = null;
        try {
            const logoBytes = await this.fetchLogo();
            if (logoBytes) {
                logoImage = await pdfDoc.embedPng(logoBytes);
            }
        } catch (error) {
            log.warn('Não foi possível carregar a logo: %o', error);
        }

        let page = pdfDoc.addPage([this.PAGE_WIDTH, this.PAGE_HEIGHT]);
        let currentY = this.PAGE_HEIGHT - this.MARGIN_TOP;

        // Seção 1: Cabeçalho
        this.drawHeader(page, boldFont, normalFont, currentY, data.numeroDocumento);

        // Seção 2: Dados da CIA
        currentY -= 10// margem
        const sectionCiaHeight = 85;
        this.drawCiaSection(page, data.cia, boldFont, normalFont, currentY, logoImage!, sectionCiaHeight);
        currentY -= sectionCiaHeight;
        
        // Seção 3: Dados do Cliente
        currentY -= 10// margem
        const sectionClienteHeight = 100;
        this.drawClienteSection(page, data.cliente, boldFont, normalFont, currentY, sectionClienteHeight);
        currentY -= sectionClienteHeight

        // Seção 4: Dados do Valor
        currentY -= 10// margem
        const sectionValueHeight = 78;
        this.drawValueSection(page, data, boldFont, normalFont, currentY, sectionValueHeight);
        currentY -= sectionValueHeight

        // Seção 5: Tabela de Detalhes — continua na mesma página (overflow cria novas páginas automaticamente)
        currentY -= 10;
        const sectionItensHeight = 150;
        this.drawItensTable(page, data, boldFont, normalFont, currentY, sectionItensHeight);
        currentY -= sectionItensHeight + 15;

        // Seção 6: Informações Adicionais (texto livre do analyzer, com quebra de linha automática)
        const sectionInformacoesAdicionaisHeight = 130;
        let informacoesAdicionais = ''
        if (data.dataFaturamento) {
            informacoesAdicionais = `PERÍODO DE FATURAMENTO: ${data.dataFaturamento}.\n`;
        }
        if (data.isPagamentoBoleto) {
            informacoesAdicionais += 'FORMA DE PAGAMENTO: BOLETO BANCÁRIO.\n';
        }

        this.drawInformacoesAdicionaisSection(page, informacoesAdicionais + data.informacoesAdicionais, boldFont, normalFont, currentY, sectionInformacoesAdicionaisHeight);
        currentY -= sectionInformacoesAdicionaisHeight + 50;

        this.drawFooterSection(page, data, boldFont, normalFont, currentY);
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
    }

    private sanitizeText(text: string | null | undefined): string {
        if (!text) return "";
        return String(text)
            .replaceAll(/[\n\r\t]/g, " ")
            .replaceAll(/\s+/g, " ")
            .trim();
    }

    private sanitizeMultilineText(text: string | null | undefined): string {
        if (!text) return "";
        return String(text)
            .replaceAll("\r\n", "\n")
            .replaceAll("\r", "\n")
            .replaceAll("\t", " ")
            .split("\n")
            .map((line) => line.replaceAll(/\s+/g, " ").trim())
            .filter((line) => line.length > 0)
            .join("\n");
    }

    private wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
        const rawLines = text.split("\n");
        const wrapped: string[] = [];

        for (const rawLine of rawLines) {
            wrapped.push(...this.wrapLine(rawLine, maxWidth, font, fontSize));
        }

        return wrapped;
    }

    private wrapLine(rawLine: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
        const words = rawLine.split(" ").filter((word) => word.length > 0);
        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const fitsCurrentLine = font.widthOfTextAtSize(testLine, fontSize) <= maxWidth;

            if (fitsCurrentLine) {
                currentLine = testLine;
                continue;
            }

            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }

        if (currentLine) lines.push(currentLine);
        return lines;
    }

    private async fetchFont(filename: string): Promise<Uint8Array> {
        const fontPath = path.resolve(__dirname, '..', '..', '..', '..', '..', 'assets', 'fonts', filename);
        const buffer = await fs.promises.readFile(fontPath);
        return new Uint8Array(buffer);
    }

    private async fetchLogo(): Promise<Uint8Array | null> {
        try {
            const logoPath = path.resolve(__dirname, '..', '..', '..', '..', '..', 'assets', 'dotz-logo.png');
            const buffer = await fs.promises.readFile(logoPath);
            return new Uint8Array(buffer);
        } catch (error) {
            log.error('Erro ao carregar logo do filesystem: %o', error);
            return null;
        }
    }

    private async drawHeader(
        page: PDFPage,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number,
        codigoDocumentoERP: string,
    ) {
        let currentY = startY;

        page.drawText('Fatura', {
            x: this.MARGIN_LEFT,
            y: currentY,
            size: this.TITLE_FONT_SIZE,
            font: normalFont,
            color: this.TEXT_FONT_COLOR,
        });

        //Data Emissão
        const now = new Date();
        const dataGeracao = formatDateToBrazilianDate(now);
        const dataText = `Emissão: ${dataGeracao}`;
        page.drawText(dataText, {
            x: this.MARGIN_LEFT + 200,
            y: currentY,
            size: this.TITLE_FONT_SIZE,
            font: normalFont,
            color: this.TEXT_FONT_COLOR,
        });

        // Código documento ERP no canto superior direito
        const erpText = 'Nr. ' + codigoDocumentoERP;
        const erpTextWidth = normalFont.widthOfTextAtSize(erpText, this.TITLE_FONT_SIZE);
        page.drawText(erpText, {
            x: this.PAGE_WIDTH - this.MARGIN_LEFT - erpTextWidth,
            y: currentY,
            size: this.TITLE_FONT_SIZE,
            font: normalFont,
            color: this.TEXT_FONT_COLOR,
        });

    }

    private drawCiaSection(
        page: PDFPage,
        cia: CiaData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number,
        logoImage: PDFImage,
        sectionHeight: number,
    ): number {
        let currentY = startY; // Margin top
        let currentX = this.MARGIN_LEFT;
        this.drawRectangleSection(page, currentY, this.PAGE_WIDTH - 2 * this.MARGIN_LEFT, sectionHeight);

        currentY -= 5; // Margen top dentro do retangulo.
        
        currentX += 5;// Margem esquerda do logo.
        page.drawImage(logoImage, {
            x: currentX,
            y: currentY - logoImage.height - 18,
            width: logoImage.width,
            height: logoImage.height,
        });

        currentX += 125;// Margem esquerda para posicionar a primeira coluna de valores.
        //Nome da CIA.
        page.drawText(this.sanitizeText(cia.nome), {
            x: currentX,
            y: currentY -= this.TEXT_FONT_SIZE,
            size: this.TEXT_FONT_SIZE,
            font: normalFont,
            color: this.TEXT_FONT_COLOR,
        });

        // LINHA 2
        currentY -= this.TEXT_FONT_SIZE + 5; // Espaçamento Linha
        this.drawLabelValue(page, 'CNPJ/CPF:', formatCpfCnpj(cia.cpfCnpj!), currentX, currentY, normalFont, normalFont, 250);

        this.drawLabelValue(page, 'I.E:', this.sanitizeText(cia.ie), currentX + 350, currentY, normalFont, normalFont, 200);
        
        //Linha 3
        currentY -= this.TEXT_FONT_SIZE + 5; // Espaçamento Linha
        this.drawLabelValue(page, 'Endereço:', this.sanitizeText(cia.endereco + ' - ' + cia.bairro), currentX, currentY, normalFont, normalFont, 400);

        //Linha 4
        currentY -= this.TEXT_FONT_SIZE + 5; // Espaçamento Linha
        this.drawLabelValue(page, 'Município:', this.sanitizeText(cia.municipio), currentX, currentY, normalFont, normalFont, 200);
        this.drawLabelValue(page, 'UF:', this.sanitizeText(cia.uf), currentX + 200, currentY, normalFont, normalFont, 150);
        this.drawLabelValue(page, 'CEP:', this.sanitizeText(formatCep(cia.cep || '')), currentX + 350, currentY, normalFont, normalFont, 150);

        //Linha 5
        currentY -= this.TEXT_FONT_SIZE + 5; // Espaçamento Linha

        this.drawLabelValue(page, 'Tel:', this.sanitizeText(cia.telefone), currentX, currentY, normalFont, normalFont, 150);
        this.drawLabelValue(page, 'E-mail:', this.sanitizeText(cia.email), currentX + 200, currentY, normalFont, normalFont, 300);
        currentY -= this.TEXT_FONT_SIZE
        return currentY;
    }

    private drawRectangleSection(page: PDFPage, currentY: number, width: number, height: number): void {
        const boxWidth = width;
        const boxHeight = height;
        const borderRadius = 4;
        const roundedBoxPath = [
            `M ${borderRadius} 0`,
            `H ${boxWidth - borderRadius}`,
            `Q ${boxWidth} 0 ${boxWidth} ${borderRadius}`,
            `V ${boxHeight - borderRadius}`,
            `Q ${boxWidth} ${boxHeight} ${boxWidth - borderRadius} ${boxHeight}`,
            `H ${borderRadius}`,
            `Q 0 ${boxHeight} 0 ${boxHeight - borderRadius}`,
            `V ${borderRadius}`,
            `Q 0 0 ${borderRadius} 0`,
            'Z',
        ].join(' ');

        page.drawSvgPath(roundedBoxPath, {
            x: this.MARGIN_LEFT,
            y: currentY,
            borderWidth: 1,
            borderColor: this.BORDER_COLOR,
        });
    }

    private drawClienteSection(
        page: PDFPage,
        cliente: ClienteData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number,
        sectionHeight:number
    ): number {
        const margemLine = 8;
        let currentY = startY; // Margin top
        let currentX = this.MARGIN_LEFT + 10; //Margem esquerda do retangulo.
        this.drawRectangleSection(page, currentY, this.PAGE_WIDTH - 2 * this.MARGIN_LEFT, sectionHeight);

        // LINHA 1
        currentY -= this.TEXT_FONT_SIZE + margemLine; // Espaçamento Linha
        this.drawLabelValueFixedSpace(page, 'Razão Social:', cliente.cardName || '', 70, currentX, currentY, normalFont, boldFont);

        // LINHA 2
        currentY -= this.TEXT_FONT_SIZE + margemLine; // Espaçamento Linha
        this.drawLabelValueFixedSpace(page, 'CNPJ/CPF:', formatCpfCnpj(cliente.cnpj!), 70, currentX, currentY, normalFont, boldFont);
        this.drawLabelValueFixedSpace(page, 'I.E:', cliente.ie || '', 40, currentX + 220, currentY, normalFont, boldFont);

        // LINHA 3
        currentY -= this.TEXT_FONT_SIZE + margemLine; // Espaçamento Linha
        this.drawLabelValueFixedSpace(page, 'Endereço:', cliente.endereco || '', 70, currentX, currentY, normalFont, boldFont);

        // LINHA 4 
        currentY -= this.TEXT_FONT_SIZE + margemLine; // Espaçamento Linha
        let municipioCia = cliente.municipio ? cliente.municipio.split(" - ")[0] : "";
        let ufCia =  cliente.municipio ? cliente.municipio.split(" - ")[1] : "";
        this.drawLabelValueFixedSpace(page, 'Município:', municipioCia || '', 70, currentX, currentY, normalFont, boldFont);
        this.drawLabelValueFixedSpace(page, 'UF:', ufCia || '', 40, currentX + 220, currentY, normalFont, boldFont);
        this.drawLabelValueFixedSpace(page, 'CEP:', formatCep(cliente.cep || '') , 40, currentX + 400, currentY, normalFont, boldFont);

        // LINHA 4 
        currentY -= this.TEXT_FONT_SIZE + margemLine; // Espaçamento Linha
        this.drawLabelValueFixedSpace(page, 'Tel:', cliente.telefone || '', 70, currentX, currentY, normalFont, boldFont);
        this.drawLabelValueFixedSpace(page, 'E-mail:', cliente.email || '', 40, currentX + 220, currentY, normalFont, boldFont);

        return currentY;
    }

    private drawValueSection(
        page: PDFPage,
        data: VendasPDFData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number,
        sectionHeight:number
    ): number {
        let currentY = startY; // Margin top
        let currentX = this.MARGIN_LEFT + 10; //Margem esquerda do retangulo.
        this.drawRectangleSection(page, currentY, this.PAGE_WIDTH - 2 * this.MARGIN_LEFT, sectionHeight);

        // LINHA 1
        currentY -= this.TEXT_FONT_SIZE + 8; // Espaçamento Linha
        this.drawLabelValueFixedSpace(page, 'Valor da fatura', formatCurrency(data.valorTotal), 140, currentX, currentY, normalFont, boldFont);
        this.drawLabelValueFixedSpace(page, 'Vencto:', data.dataVencimento, 40, currentX + 430, currentY, normalFont, boldFont);

        return currentY;
    }

    private drawFooterSection(
        page: PDFPage,
        data: VendasPDFData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number,
    ): void {
        let currentY = startY; // Margin top
        let currentX = this.MARGIN_LEFT; //
        const fontSize = 7;

        page.drawText('Fat-SP ' + data.numeroDocumento, {
            x: currentX + 5,
            y: currentY,
            size: fontSize,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });

        const labelWidth = boldFont.widthOfTextAtSize(data.numeroFaturaParceiro, fontSize);
        page.drawText(data.numeroFaturaParceiro, {
            x: this.PAGE_WIDTH - labelWidth - 10,
            y: currentY,
            size: fontSize,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });
    }

    private drawInformacoesAdicionaisSection(
        initialPage: PDFPage,
        text: string,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number,
        sectionHeight: number
    ): { page: PDFPage; y: number } {
        if (!text) {
            return { page: initialPage, y: startY };
        }

        const maxWidth = this.PAGE_WIDTH - 2 * this.MARGIN_LEFT;
        const lines = this.wrapText(this.sanitizeMultilineText(text), maxWidth, normalFont, this.TEXT_FONT_SIZE);

        if (lines.length === 0) {
            return { page: initialPage, y: startY };
        }

        let currentPage = initialPage;
        let currentY = startY;

        // const titleHeight = 23;
        // const contentHeight = lines.length * this.LINE_HEIGHT + 10;
        // if (currentY - titleHeight - contentHeight < this.MARGIN_LEFT) {
        //     currentPage = pdfDoc.addPage([this.PAGE_WIDTH, this.PAGE_HEIGHT]);
        //     currentY = this.PAGE_HEIGHT - this.MARGIN_LEFT;
        // }

        currentY -= this.TEXT_FONT_SIZE + 20
        currentPage.drawText('Dados Adicionais', {
            x: this.MARGIN_LEFT,
            y: currentY,
            size: this.TEXT_FONT_SIZE,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });


        currentY -= 10;
        this.drawRectangleSection(currentPage, currentY, this.PAGE_WIDTH - 2 * this.MARGIN_LEFT, sectionHeight);
        currentY -= 20;

        for (const line of lines) {
            currentPage.drawText(line, {
                x: this.MARGIN_LEFT + 5,
                y: currentY,
                size: this.TEXT_FONT_SIZE,
                font: normalFont,
                color: this.TEXT_FONT_COLOR,
            });
            currentY -= this.LINE_HEIGHT;
        }

        currentY -= 10;
        return { page: currentPage, y: currentY };
    }

    private async drawItensTable(
        initialPage: PDFPage,
        data: VendasPDFData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number,
        sectionHeight:number
    ): Promise<{ page: PDFPage; y: number }> {
        let currentPage = initialPage;
        let currentY = startY;

        // let rectangleHeight = sectionHeight - 10;
        currentY -= 10

        // Desenhar cabeçalho da tabela
        const TEXT_FONT_SIZE_HEADER = 9;
        currentPage.drawText('Descrição:', {
            x: this.MARGIN_LEFT + 4,
            y: currentY,
            size: TEXT_FONT_SIZE_HEADER,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });
        currentPage.drawText('Quantidade', {
            x: this.MARGIN_LEFT + 305,
            y: currentY,
            size: TEXT_FONT_SIZE_HEADER,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });
        currentPage.drawText('Custo unitário', {
            x: this.MARGIN_LEFT + 385,
            y: currentY,
            size: TEXT_FONT_SIZE_HEADER,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });
        currentPage.drawText('Valor', {
            x: this.MARGIN_LEFT + 530,
            y: currentY,
            size: TEXT_FONT_SIZE_HEADER,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });

        currentY -= 5
        this.drawRectangleSection(currentPage, currentY, this.PAGE_WIDTH - 2 * this.MARGIN_LEFT, sectionHeight);
        
        currentY -= 10;
        let lineY = currentY;
        for (const detalhe of data.detalhes) {
            lineY -= 10;
            currentPage.drawText(detalhe.descricaoProduto ?? detalhe.codigoProdutoDotz ?? '' , {
                x: this.MARGIN_LEFT + 4,
                y: lineY,
                size: TEXT_FONT_SIZE_HEADER,
                font: normalFont,
                color: this.TEXT_FONT_COLOR,
            });
            currentPage.drawText(numberFormatter(detalhe.quantidadePontos, 3), {
                x: this.MARGIN_LEFT + 330,
                y: lineY,
                size: TEXT_FONT_SIZE_HEADER,
                font: normalFont,
                color: this.TEXT_FONT_COLOR,
            });
            currentPage.drawText(numberFormatter(detalhe.precoUnitario, 4), {
                x: this.MARGIN_LEFT + 430,
                y: lineY,
                size: TEXT_FONT_SIZE_HEADER,
                font: normalFont,
                color: this.TEXT_FONT_COLOR,
            });
            currentPage.drawText(numberFormatter(detalhe.valorVenda, 2), {
                x: this.MARGIN_LEFT + 520,
                y: lineY,
                size: TEXT_FONT_SIZE_HEADER,
                font: normalFont,
                color: this.TEXT_FONT_COLOR,
            });
        }

        currentY -= 100
        currentPage.drawText('Desconto', {
            x: this.MARGIN_LEFT + 305,
            y: currentY,
            size: TEXT_FONT_SIZE_HEADER,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });
        currentPage.drawText('0,00', {
            x: this.MARGIN_LEFT + 540,
            y: currentY,
            size: TEXT_FONT_SIZE_HEADER,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });

        currentY -= 15
        currentPage.drawText('Vlt. Líquido', {
            x: this.MARGIN_LEFT + 305,
            y: currentY,
            size: TEXT_FONT_SIZE_HEADER,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });
        currentPage.drawText(numberFormatter(data.valorTotal), {
            x: this.MARGIN_LEFT + 520,
            y: currentY,
            size: TEXT_FONT_SIZE_HEADER,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });
        
        return { page: currentPage, y: currentY };
    }

    /**
     * Desenha um par label/valor. Quando maxWidth é informado e o valor não cabe
     * ao lado do label dentro do limite da coluna, o valor quebra para a(s) linha(s)
     * abaixo em vez de invadir a coluna seguinte.
     * Retorna quantas linhas foram ocupadas (para o chamador ajustar o Y seguinte).
     */
    private drawLabelValue(
        page: PDFPage,
        label: string,
        value: string,
        x: number,
        y: number,
        boldFont: PDFFont,
        normalFont: PDFFont,
        maxWidth?: number,
    ): number {
        page.drawText(label, {
            x,
            y,
            size: this.TEXT_FONT_SIZE,
            font: boldFont,
            color: this.TEXT_FONT_COLOR,
        });

        const labelWidth = boldFont.widthOfTextAtSize(label, this.TEXT_FONT_SIZE);
        const valueOffsetX = labelWidth + 2;
        const valueWidth = normalFont.widthOfTextAtSize(value, this.TEXT_FONT_SIZE);
        const availableInline = maxWidth ? maxWidth - valueOffsetX : undefined;

        if (!maxWidth || valueWidth <= availableInline!) {
            page.drawText(value, {
                x: x + valueOffsetX,
                y,
                size: this.TEXT_FONT_SIZE,
                font: normalFont,
                color: rgb(0, 0, 0),
            });
            return 1;
        }

        const lines = this.wrapLine(value, maxWidth, normalFont, this.TEXT_FONT_SIZE);
        let lineY = y - this.LINE_HEIGHT;
        for (const line of lines) {
            page.drawText(line, {
                x,
                y: lineY,
                size: this.TEXT_FONT_SIZE,
                font: normalFont,
                color: rgb(0, 0, 0),
            });
            lineY -= this.LINE_HEIGHT;
        }

        return 1 + lines.length;
    }

    private drawLabelValueFixedSpace(
        page: PDFPage,
        label: string,
        value: string,
        space: number,
        x: number,
        y: number,
        labelFont: PDFFont,
        textFont: PDFFont,
    ): void {
        page.drawText(label, {
            x,
            y,
            size: this.TEXT_FONT_SIZE,
            font: labelFont,
            color: this.TEXT_FONT_COLOR,
        });

        page.drawText(value, {
            x: x + space,
            y,
            size: this.TEXT_FONT_SIZE,
            font: textFont,
            color: this.TEXT_FONT_COLOR,
        });
    }

}
