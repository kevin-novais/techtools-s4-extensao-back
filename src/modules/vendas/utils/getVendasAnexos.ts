import type { VendasAnexos } from "@/modules/vendas/services/VendasAnexosStorageService";

export function getVendasAnexos(files: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined): VendasAnexos {
    if (!files || Array.isArray(files)) return {};

    return {
        arquivoFaturaDetalhada: files.arquivoFaturaDetalhada?.[0],
        arquivoRelatorioAnalitico: files.arquivoRelatorioAnalitico?.[0],
    };
}
