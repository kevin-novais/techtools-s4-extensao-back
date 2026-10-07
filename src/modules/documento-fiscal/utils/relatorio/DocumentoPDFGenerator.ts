import { PDFDocument, PDFPage, StandardFonts, rgb, PDFFont, PDFImage } from 'pdf-lib';
import { formatCpfCnpj } from '@/util/formatters/documentFormatter';
import { formatTelefone } from '@/util/formatters/telefone';
import { formatCep } from '@/util/formatters/cep';
import { formatCurrency } from '@/util/formatters/currency';
import { formatDateToBrazilianTimezone } from '@/util/date';
import fs from 'node:fs';
import path from 'node:path';
import log from '@/util/logger';

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
}

interface FornecedorData {
    cardName: string | null;
    cnpj: string | null;
    ie: string | null;
    endereco: string | null;
    municipio: string | null;
    cep: string | null;
}

interface DetalheData {
    data: string;
    cnpj: string;
    pedido: string;
    nome: string;
    codigo: string;
    parceiro: string;
    produto: string;
    descricao: string;
    valorProduto: string;
    frete: string;
}

interface ResumoData {
    quantidadePedidos: number;
    valorTotalDocumento: string;
}

interface DocumentoPDFData {
    cia: CiaData;
    fornecedor: FornecedorData;
    resumo: ResumoData;
    detalhes: DetalheData[];
    totalValorProduto: string;
    totalFrete: string;
}

export class DocumentoPDFGenerator {
    private readonly PAGE_WIDTH = 842; // A4 landscape width
    private readonly PAGE_HEIGHT = 595; // A4 landscape height
    private readonly MARGIN = 50;
    private readonly SMALL_FONT_SIZE = 7;
    private readonly NORMAL_FONT_SIZE = 9;
    private readonly TITLE_FONT_SIZE = 16;
    private readonly SUBTITLE_FONT_SIZE = 12;
    private readonly LINE_HEIGHT = 12;
    
    // Cores do tema Dotz
    private readonly DOTZ_BLUE = rgb(0, 0.53, 0.71); // Azul Dotz
    private readonly DARK_GRAY = rgb(0.2, 0.2, 0.2);
    private readonly LIGHT_GRAY = rgb(0.95, 0.95, 0.95);
    private readonly BORDER_GRAY = rgb(0.7, 0.7, 0.7);

    /**
     * Sanitiza texto para remover caracteres que o pdf-lib não consegue renderizar
     * Remove quebras de linha, tabs e outros caracteres de controle
     */
    private sanitizeText(text: string | null | undefined): string {
        if (!text) return "";

        return String(text)
            .replaceAll(/[\n\r\t]/g, " ")  // Remove quebras de linha e tabs
            .replaceAll(/\s+/g, " ")        // Substitui múltiplos espaços por um único
            .trim();                      // Remove espaços do início e fim
    }

    async generate(data: DocumentoPDFData): Promise<Buffer> {
        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Tentar carregar logo (usar PNG fallback se SVG não funcionar)
        let logoImage: PDFImage | null = null;
        try {
            const logoBytes = await this.fetchLogo();
            if (logoBytes) {
                logoImage = await pdfDoc.embedPng(logoBytes);
            }
        } catch (error) {
            // Se falhar ao carregar logo, continua sem ela
            log.warn('Não foi possível carregar a logo: %o', error);
        }

        let page = pdfDoc.addPage([this.PAGE_WIDTH, this.PAGE_HEIGHT]);
        let currentY = this.PAGE_HEIGHT - this.MARGIN;

        // Seção 1: Cabeçalho com logo e data
        currentY = await this.drawHeader(page, helveticaBoldFont, helveticaFont, currentY, logoImage);

        // Título principal
        currentY = this.drawMainTitle(page, helveticaBoldFont, currentY);

        // Seção 2: Dados da CIA
        currentY = this.drawCiaSection(page, data.cia, helveticaBoldFont, helveticaFont, currentY);

        // Linha separadora
        this.drawSeparatorLine(page, currentY);
        currentY -= 20;

        // Seção 3: Dados do Fornecedor
        currentY = this.drawFornecedorSection(page, data.fornecedor, helveticaBoldFont, helveticaFont, currentY);

        // Linha separadora
        this.drawSeparatorLine(page, currentY);
        currentY -= 20;

        // Seção 4: Resumo do Documento
        currentY = this.drawResumoSection(page, data.resumo, helveticaBoldFont, helveticaFont, currentY);

        // Linha separadora
        this.drawSeparatorLine(page, currentY);
        currentY -= 20;

        // Seção 5: Tabela de Detalhes (pode precisar de múltiplas páginas)
        await this.drawDetalhesTable(
            pdfDoc,
            page,
            data,
            helveticaBoldFont,
            helveticaFont,
            currentY
        );

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
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
        logoImage: PDFImage | null
    ): Promise<number> {
        let currentY = startY;

        // Logo
        if (logoImage) {
            const logoHeight = 35;
            const logoWidth = logoImage.width * (logoHeight / logoImage.height);
            
            page.drawImage(logoImage, {
                x: this.MARGIN,
                y: currentY - logoHeight,
                width: logoWidth,
                height: logoHeight,
            });
        } else {
            // Fallback: texto DOTZ
            page.drawText('DOTZ', {
                x: this.MARGIN,
                y: currentY - 25,
                size: 24,
                font: boldFont,
                color: this.DARK_GRAY,
            });
        }

        // Data e hora de geração no canto direito
        const now = new Date();
        const dataGeracao = formatDateToBrazilianTimezone(now);
        const dataText = `Gerado em: ${dataGeracao}`;
        const textWidth = normalFont.widthOfTextAtSize(dataText, this.NORMAL_FONT_SIZE);
        
        page.drawText(dataText, {
            x: this.PAGE_WIDTH - this.MARGIN - textWidth,
            y: currentY - 10,
            size: this.NORMAL_FONT_SIZE,
            font: normalFont,
            color: this.DARK_GRAY,
        });

        currentY -= 50;
        return currentY;
    }

    private drawMainTitle(page: PDFPage, boldFont: PDFFont, startY: number): number {
        let currentY = startY;

        // Título centralizado
        const title = 'Relatório Documento Financeiro';
        const titleWidth = boldFont.widthOfTextAtSize(title, this.TITLE_FONT_SIZE);
        const centerX = (this.PAGE_WIDTH - titleWidth) / 2;

        page.drawText(title, {
            x: centerX,
            y: currentY,
            size: this.TITLE_FONT_SIZE,
            font: boldFont,
            color: this.DOTZ_BLUE,
        });

        // Linha abaixo do título
        currentY -= 8;
        page.drawLine({
            start: { x: centerX, y: currentY },
            end: { x: centerX + titleWidth, y: currentY },
            thickness: 2,
            color: this.DOTZ_BLUE,
        });

        currentY -= 25;
        return currentY;
    }

    private drawSeparatorLine(page: PDFPage, y: number): void {
        page.drawLine({
            start: { x: this.MARGIN, y: y - 5 },
            end: { x: this.PAGE_WIDTH - this.MARGIN, y: y - 5 },
            thickness: 0.5,
            color: this.BORDER_GRAY,
        });
    }

    private drawCiaSection(
        page: PDFPage,
        cia: CiaData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number
    ): number {
        let currentY = startY;

        // Nome da CIA (sem label, sem sublinhado, sem cor especial)
        page.drawText(this.sanitizeText(cia.nome), {
            x: this.MARGIN,
            y: currentY,
            size: this.SUBTITLE_FONT_SIZE,
            font: boldFont,
            color: this.DARK_GRAY,
        });

        currentY -= 18;

        // Dados em duas colunas
        const col1X = this.MARGIN;
        const col2X = this.PAGE_WIDTH / 2 + 10;
        let col1Y = currentY;
        let col2Y = currentY;

        // Coluna 1 (sem o Nome, pois já foi exibido acima)
        const col1Data = [
            { label: 'CNPJ/CPF:', value: cia.cpfCnpj ? formatCpfCnpj(cia.cpfCnpj) : 'N/A' },
            { label: 'I.E.:', value: this.sanitizeText(cia.ie) || 'Isento' },
            { label: 'Endereço:', value: this.sanitizeText(cia.endereco) || 'N/A' },
        ];

        for (const item of col1Data) {
            page.drawText(item.label, {
                x: col1X,
                y: col1Y,
                size: this.NORMAL_FONT_SIZE,
                font: boldFont,
                color: this.DARK_GRAY,
            });
            
            const labelWidth = boldFont.widthOfTextAtSize(item.label, this.NORMAL_FONT_SIZE);
            page.drawText(item.value, {
                x: col1X + labelWidth + 5,
                y: col1Y,
                size: this.NORMAL_FONT_SIZE,
                font: normalFont,
                color: rgb(0, 0, 0),
            });
            
            col1Y -= this.LINE_HEIGHT;
        }

        // Coluna 2
        const col2Data = [
            { label: 'Bairro:', value: this.sanitizeText(cia.bairro) || 'N/A' },
            { label: 'Município:', value: this.sanitizeText(cia.municipio) || 'N/A' },
            { label: 'UF:', value: this.sanitizeText(cia.uf) || 'N/A' },
            { label: 'CEP:', value: cia.cep ? formatCep(cia.cep) : 'N/A' },
        ];

        for (const item of col2Data) {
            page.drawText(item.label, {
                x: col2X,
                y: col2Y,
                size: this.NORMAL_FONT_SIZE,
                font: boldFont,
                color: this.DARK_GRAY,
            });
            
            const labelWidth = boldFont.widthOfTextAtSize(item.label, this.NORMAL_FONT_SIZE);
            page.drawText(item.value, {
                x: col2X + labelWidth + 5,
                y: col2Y,
                size: this.NORMAL_FONT_SIZE,
                font: normalFont,
                color: rgb(0, 0, 0),
            });
            
            col2Y -= this.LINE_HEIGHT;
        }

        // Telefone (embaixo, full width)
        if (cia.telefone) {
            col1Y -= 2;
            page.drawText('Tel:', {
                x: col1X,
                y: col1Y,
                size: this.NORMAL_FONT_SIZE,
                font: boldFont,
                color: this.DARK_GRAY,
            });
            
            // Formatar telefone no padrão internacional brasileiro
            const telefoneFormatado = formatTelefone(cia.telefone);
            
            page.drawText(telefoneFormatado, {
                x: col1X + 25,
                y: col1Y,
                size: this.NORMAL_FONT_SIZE,
                font: normalFont,
                color: rgb(0, 0, 0),
            });

            col1Y -= this.LINE_HEIGHT;
        }

        // Calcular Y final baseado no menor Y das colunas
        currentY = Math.min(col1Y, col2Y) - 10;
        return currentY;
    }

    private drawFornecedorSection(
        page: PDFPage,
        fornecedor: FornecedorData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number
    ): number {
        let currentY = startY;

        // Título da seção
        page.drawText('Fornecedor', {
            x: this.MARGIN,
            y: currentY,
            size: this.SUBTITLE_FONT_SIZE,
            font: boldFont,
            color: this.DARK_GRAY,
        });
        currentY -= 18;

        // Dados do fornecedor em duas colunas
        const col1X = this.MARGIN;
        const col2X = this.PAGE_WIDTH / 2 + 10;
        let col1Y = currentY;
        let col2Y = currentY;

        // Coluna 1
        const col1Data = [
            { label: 'CNPJ:', value: fornecedor.cnpj ? formatCpfCnpj(fornecedor.cnpj) : 'N/A' },
            { label: 'Nome:', value: this.sanitizeText(fornecedor.cardName) || 'N/A' },
            { label: 'I.E.:', value: this.sanitizeText(fornecedor.ie) || 'Isento' },
        ];

        for (const item of col1Data) {
            page.drawText(item.label, {
                x: col1X,
                y: col1Y,
                size: this.NORMAL_FONT_SIZE,
                font: boldFont,
                color: this.DARK_GRAY,
            });
            
            const labelWidth = boldFont.widthOfTextAtSize(item.label, this.NORMAL_FONT_SIZE);
            page.drawText(item.value, {
                x: col1X + labelWidth + 5,
                y: col1Y,
                size: this.NORMAL_FONT_SIZE,
                font: normalFont,
                color: rgb(0, 0, 0),
            });
            
            col1Y -= this.LINE_HEIGHT;
        }

        // Coluna 2
        const col2Data = [
            { label: 'Endereço:', value: this.sanitizeText(fornecedor.endereco) || 'N/A' },
            { label: 'Município:', value: this.sanitizeText(fornecedor.municipio) || 'N/A' },
            { label: 'CEP:', value: fornecedor.cep ? formatCep(fornecedor.cep) : 'N/A' },
        ];

        for (const item of col2Data) {
            page.drawText(item.label, {
                x: col2X,
                y: col2Y,
                size: this.NORMAL_FONT_SIZE,
                font: boldFont,
                color: this.DARK_GRAY,
            });
            
            const labelWidth = boldFont.widthOfTextAtSize(item.label, this.NORMAL_FONT_SIZE);
            page.drawText(item.value, {
                x: col2X + labelWidth + 5,
                y: col2Y,
                size: this.NORMAL_FONT_SIZE,
                font: normalFont,
                color: rgb(0, 0, 0),
            });
            
            col2Y -= this.LINE_HEIGHT;
        }

        // Calcular Y final baseado no menor Y das colunas
        currentY = Math.min(col1Y, col2Y) - 5;
        return currentY;
    }

    private drawResumoSection(
        page: PDFPage,
        resumo: ResumoData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number
    ): number {
        let currentY = startY;

        // Título da seção
        page.drawText('Resumo do Documento', {
            x: this.MARGIN,
            y: currentY,
            size: this.SUBTITLE_FONT_SIZE,
            font: boldFont,
            color: this.DOTZ_BLUE,
        });

        // Linha decorativa abaixo do título
        const titleWidth = boldFont.widthOfTextAtSize('Resumo do Documento', this.SUBTITLE_FONT_SIZE);
        currentY -= 5;
        page.drawLine({
            start: { x: this.MARGIN, y: currentY },
            end: { x: this.MARGIN + titleWidth, y: currentY },
            thickness: 2,
            color: this.DOTZ_BLUE,
        });

        currentY -= 20;

        // Dados do resumo em grid de 2 colunas
        const col1X = this.MARGIN;
        const col2X = this.PAGE_WIDTH / 2 + 10;

        // Coluna 1: Quantidade de Pedidos
        page.drawText('Quantidade de Pedidos:', {
            x: col1X,
            y: currentY,
            size: this.NORMAL_FONT_SIZE,
            font: boldFont,
            color: this.DARK_GRAY,
        });

        const labelWidth1 = boldFont.widthOfTextAtSize('Quantidade de Pedidos:', this.NORMAL_FONT_SIZE);
        page.drawText(resumo.quantidadePedidos.toString(), {
            x: col1X + labelWidth1 + 8,
            y: currentY,
            size: this.NORMAL_FONT_SIZE,
            font: normalFont,
            color: rgb(0, 0, 0),
        });

        // Coluna 2: Valor Total
        page.drawText('Valor Total do Documento:', {
            x: col2X,
            y: currentY,
            size: this.NORMAL_FONT_SIZE,
            font: boldFont,
            color: this.DARK_GRAY,
        });

        const labelWidth2 = boldFont.widthOfTextAtSize('Valor Total do Documento:', this.NORMAL_FONT_SIZE);
        page.drawText(formatCurrency(resumo.valorTotalDocumento), {
            x: col2X + labelWidth2 + 8,
            y: currentY,
            size: this.NORMAL_FONT_SIZE,
            font: normalFont,
            color: this.DOTZ_BLUE,
        });

        currentY -= 20;
        return currentY;
    }

    private async drawDetalhesTable(
        pdfDoc: PDFDocument,
        initialPage: PDFPage,
        data: DocumentoPDFData,
        boldFont: PDFFont,
        normalFont: PDFFont,
        startY: number
    ): Promise<void> {
        let currentPage = initialPage;
        let currentY = startY;
        const detalhes = data.detalhes;
        const totalValorProduto = data.totalValorProduto;
        const totalFrete = data.totalFrete;

        // Título da tabela
        currentPage.drawText('Detalhes dos Pedidos', {
            x: this.MARGIN,
            y: currentY,
            size: this.SUBTITLE_FONT_SIZE,
            font: boldFont,
            color: this.DARK_GRAY,
        });
        currentY -= 20;

        // Definir colunas da tabela (ajustadas para caber no A4 landscape)
        const columns = [
            { header: 'Data', width: 60, key: 'data' },
            { header: 'CNPJ', width: 75, key: 'cnpj' },
            { header: 'Pedido', width: 50, key: 'pedido' },
            { header: 'Nome', width: 80, key: 'nome' },
            { header: 'Código', width: 50, key: 'codigo' },
            { header: 'Parceiro', width: 80, key: 'parceiro' },
            { header: 'Produto', width: 60, key: 'produto' },
            { header: 'Descrição', width: 120, key: 'descricao' },
            { header: 'Vlr Produto', width: 60, key: 'valorProduto' },
            { header: 'Frete', width: 50, key: 'frete' },
        ];

        const tableStartX = this.MARGIN;
        const rowHeight = 15;

        // Desenhar cabeçalho da tabela
        let xPosition = tableStartX;
        for (const column of columns) {
            currentPage.drawRectangle({
                x: xPosition,
                y: currentY - rowHeight,
                width: column.width,
                height: rowHeight,
                color: this.DOTZ_BLUE,
                borderColor: this.DARK_GRAY,
                borderWidth: 0.5,
            });

            const text = this.truncateText(column.header, column.width - 4, boldFont, this.SMALL_FONT_SIZE);
            currentPage.drawText(text, {
                x: xPosition + 2,
                y: currentY - rowHeight + 4,
                size: this.SMALL_FONT_SIZE,
                font: boldFont,
                color: rgb(1, 1, 1), // Texto branco no cabeçalho azul
            });

            xPosition += column.width;
        }

        currentY -= rowHeight;

        // Desenhar linhas de dados
        for (const detalhe of detalhes) {
            // Verificar se precisa de nova página
            if (currentY - rowHeight < this.MARGIN + 30) {
                currentPage = pdfDoc.addPage([this.PAGE_WIDTH, this.PAGE_HEIGHT]);
                currentY = this.PAGE_HEIGHT - this.MARGIN;
            }

            xPosition = tableStartX;
            for (const column of columns) {
                currentPage.drawRectangle({
                    x: xPosition,
                    y: currentY - rowHeight,
                    width: column.width,
                    height: rowHeight,
                    color: rgb(1, 1, 1),
                    borderColor: this.BORDER_GRAY,
                    borderWidth: 0.5,
                });

                let value = detalhe[column.key as keyof DetalheData] || '';
                
                // Sanitizar texto para remover quebras de linha
                value = this.sanitizeText(value);

                // Formatar valores específicos
                if (column.key === 'cnpj' && value !== 'N/A') {
                    value = formatCpfCnpj(value);
                } else if (column.key === 'valorProduto' || column.key === 'frete') {
                    value = formatCurrency(value);
                }
                
                const text = this.truncateText(value, column.width - 4, normalFont, this.SMALL_FONT_SIZE);
                
                currentPage.drawText(text, {
                    x: xPosition + 2,
                    y: currentY - rowHeight + 4,
                    size: this.SMALL_FONT_SIZE,
                    font: normalFont,
                    color: rgb(0, 0, 0),
                });

                xPosition += column.width;
            }

            currentY -= rowHeight;
        }

        // Linha de totais
        if (currentY - rowHeight < this.MARGIN + 30) {
            currentPage = pdfDoc.addPage([this.PAGE_WIDTH, this.PAGE_HEIGHT]);
            currentY = this.PAGE_HEIGHT - this.MARGIN;
        }

        xPosition = tableStartX;
        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            
            currentPage.drawRectangle({
                x: xPosition,
                y: currentY - rowHeight,
                width: column.width,
                height: rowHeight,
                color: this.LIGHT_GRAY,
                borderColor: this.DARK_GRAY,
                borderWidth: 1,
            });

            let text = '';
            if (i === 0) {
                text = 'TOTAL:';
            } else if (column.key === 'valorProduto') {
                text = formatCurrency(totalValorProduto);
            } else if (column.key === 'frete') {
                text = formatCurrency(totalFrete);
            }

            if (text) {
                const truncatedText = this.truncateText(text, column.width - 4, boldFont, this.SMALL_FONT_SIZE);
                currentPage.drawText(truncatedText, {
                    x: xPosition + 2,
                    y: currentY - rowHeight + 4,
                    size: this.SMALL_FONT_SIZE,
                    font: boldFont,
                    color: rgb(0, 0, 0),
                });
            }

            xPosition += column.width;
        }
    }

    private truncateText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string {
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        
        if (textWidth <= maxWidth) {
            return text;
        }

        let truncated = text;
        while (font.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
        }

        return truncated + '...';
    }
}
