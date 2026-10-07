export interface BankPlusInventAuthRequest {
    username: string;
    Password: string;
}

export interface BankPlusInventAuthResponse {
    token: string;
    expiresIn: number;
    tokenType: string | null;
    url: string;
}

export interface BankPlusInventDocumentoIdParts {
    codigoEmpresa: string | number;
    anoFiscal: string | number;
    numeroDocumento: string;
    tipoDocumento: string;
    codigoParceiro: string;
}

export type BankPlusInventBoletoResponse = Buffer;
