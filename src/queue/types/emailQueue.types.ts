export enum EmailType {
    WELCOME = 'WELCOME',
    FORGOT_PASSWORD = 'FORGOT_PASSWORD',
    FORNECEDOR_RELATORIO = 'FORNECEDOR_RELATORIO',
    VENDAS_RELATORIO = 'VENDAS_RELATORIO',
}

export interface BaseEmailMessage {
    type: EmailType;
    timestamp: Date;
}

export interface WelcomeEmailMessage extends BaseEmailMessage {
    type: EmailType.WELCOME;
    data: {
        nome: string;
        email: string;
        senha: string;
        appUrl: string;
    };
}

export interface ForgotPasswordEmailMessage extends BaseEmailMessage {
    type: EmailType.FORGOT_PASSWORD;
    data: {
        nome: string;
        email: string;
        resetLink: string;
        expirationMinutes: number;
    };
}

export interface FornecedorRelatorioEmailMessage extends BaseEmailMessage {
    type: EmailType.FORNECEDOR_RELATORIO;
    data: {
        email: string;
        dataEmissao: string;
        dataVencimento: string;
        dotzEmailTrocas: string;
        dotzEmailContasReceber: string;
        telefoneContasReceber: string;
        relatorioPdfFilename: string;
        relatorioPdfPath: string;
        relatorioXlsxFilename: string;
        relatorioXlsxPath: string;
    };
}

export interface VendasRelatorioEmailMessage extends BaseEmailMessage {
    type: EmailType.VENDAS_RELATORIO;
    data: {
        vendasHeaderId: number;
        email: string;
        dataEmissao: string;
        dataVencimento: string;
        codigoBoleto: string;
        dotzEmailTrocas: string;
        dotzEmailContasReceber: string;
        telefoneContasReceber: string;
        relatorioPdfFilename: string;
        relatorioPdfPath: string;
        relatorioXlsxFilename: string;
        relatorioXlsxPath: string;
        boletoFilename?: string;
        boletoPath?: string;
        analyzerFaturaDetalhadaFilename?: string;
        analyzerFaturaDetalhadaPath?: string;
        analyzerRelatorioAnaliticoFilename?: string;
        analyzerRelatorioAnaliticoPath?: string;
    };
}

export type EmailQueueMessage =
    | WelcomeEmailMessage
    | ForgotPasswordEmailMessage
    | FornecedorRelatorioEmailMessage
    | VendasRelatorioEmailMessage;

