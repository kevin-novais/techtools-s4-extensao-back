import { ContasBancarias } from "@prisma/client-s4-dotz";
import { formatDateToBrazilianTimezone } from "@/util/date";

export const formatContasBancarias = (record: ContasBancarias) => ({
    codigoCia: record.CodigoCia,
    houseBank: record.HouseBank,
    houseBankAccount: record.HouseBankAccount,
    numeroBanco: record.NumeroBanco,
    numeroAgencia: record.NumeroAgencia,
    nomeBanco: record.NomeBanco,
    digitoAgenca: record.DigitoAgenca ?? null,
    numeroConta: record.NumeroConta,
    digitoConta: record.DigitoConta,
    glAccount: record.GLAccount,
    numeroBancoLegado: record.NumeroBancoLegado ?? null,
    numeroAgenciaLegado: record.NumeroAgenciaLegado ?? null,
    digitoAgenciaLegado: record.DigitoAgenciaLegado ?? null,
    numeroContaLegado: record.NumeroContaLegado ?? null,
    digitoContaLegado: record.DigitoContaLegado ?? null,
    criadoEm: formatDateToBrazilianTimezone(record.criadoEm),
    atualizadoEm: formatDateToBrazilianTimezone(record.atualizadoEm),
});
