import s4DotzClient from "@/database/clients/s4DotzClient";
import AppError from "@/util/AppError";
import { formatDateToBrazilianTimezone } from "@/util/date";
import { formatCpfCnpj } from "@/util/formatters/documentFormatter";
import { normalizarTelefone } from "@/util/formatters/phoneNumberFormatter";

interface CIAUpdateServiceProps {
    nome: string;
    ciaIdSAP?: string;
    nomeBaseDadosB1?: string;
    ie?: string;
    endereco?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    bairro?: string;
    cpfCnpj?: string;
    telefone?: string;
    atualizadoPor: number;
}

export class CIAUpdateService {
    async execute(ciaId: number, data: CIAUpdateServiceProps) {
        const {
            nome,
            ciaIdSAP,
            nomeBaseDadosB1,
            ie,
            endereco,
            municipio,
            uf,
            cep,
            bairro,
            cpfCnpj,
            telefone,
            atualizadoPor,
        } = data;

        const cpfCnpjDigits = this.sanitizeCpfCnpj(cpfCnpj);
        const telefoneDigits = this.sanitizeTelefone(telefone);
        const cepDigits = this.sanitizeCep(cep);

        const ciaExist = await s4DotzClient.cia.findUnique({
            where: { id: ciaId },
        });

        if (!ciaExist) {
            throw new AppError("CIA não encontrada", 404);
        }

        if (ciaExist.deletadoEm) {
            throw new AppError("CIA não pode ser atualizada pois está deletada", 400);
        }

        const ciaExistNome = await s4DotzClient.cia.findFirst({
            where: {
                nome,
            },
        });

        if (ciaExistNome && ciaExistNome.id !== ciaId) {
            throw new AppError("Nome de CIA já utilizado", 400);
        }

        const cia = await s4DotzClient.cia.update({
            where: { id: ciaId },
            data: {
                nome,
                ciaIdSAP,
                nomeBaseDadosB1,
                ie,
                endereco,
                municipio,
                uf,
                cep: cepDigits,
                bairro,
                cpfCnpj: cpfCnpjDigits,
                telefone: telefoneDigits,
                atualizadoPor,
                atualizadoEm: new Date(),
            },
        });

        return this.formatResponse(cia);
    }

    private sanitizeCpfCnpj(cpfCnpj?: string) {
        if (!cpfCnpj) return undefined;

        const digits = cpfCnpj.replaceAll(/\D/g, "");
        const isValidLength = digits.length === 11 || digits.length === 14;

        if (!isValidLength) {
            throw new AppError("CPF/CNPJ inválido", 400);
        }

        return digits;
    }

    private sanitizeTelefone(telefone?: string) {
        if (!telefone) return undefined;

        const normalized = normalizarTelefone(telefone);

        return normalized.e164.replaceAll(/\D/g, "");
    }

    private sanitizeCep(cep?: string) {
        if (!cep) return undefined;

        const digits = cep.replaceAll(/\D/g, "");
        if (digits && digits.length !== 8) {
            throw new AppError("CEP inválido", 400);
        }

        return digits;
    }

    private formatTelefoneForResponse(telefone?: string | null) {
        if (!telefone) return null;

        return normalizarTelefone(`+${telefone}`).e164;
    }

    private formatResponse(cia: any) {
        return {
            id: cia.id,
            nome: cia.nome,
            ciaIdSAP: cia.ciaIdSAP,
            nomeBaseDadosB1: cia.nomeBaseDadosB1 ?? null,
            ie: cia.ie,
            endereco: cia.endereco,
            municipio: cia.municipio,
            uf: cia.uf,
            cep: cia.cep,
            bairro: cia.bairro,
            cpfCnpj: cia.cpfCnpj ? formatCpfCnpj(cia.cpfCnpj) : null,
            telefone: this.formatTelefoneForResponse(cia.telefone),
            atualizadoPor: cia.atualizadoPor,
            atualizadoEm: formatDateToBrazilianTimezone(cia.atualizadoEm),
        };
    }
}

