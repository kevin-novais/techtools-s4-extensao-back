import getDotzStageClient from "@/database/clients/dotzStageClient";
import {
  PosFormatter,
  PosItem,
} from "@/modules/documento-fiscal/documento-details/pos/services/PosFormatter";
import { PosRawQueryRepository } from "@/modules/documento-fiscal/documento-details/pos/services/PosRawQueryRepository";
import log from "@/util/logger";

interface PosListFilterAnalyzerParams {
  dataEmissaoDe?: string;
  dataEmissaoAte?: string;
  dataVencimentoDe?: string;
  dataVencimentoAte?: string;
  segmento?: string;
  page?: number;
  limit?: number;
  filterModel?: string;
  sortModel?: string;
}

interface PosListFilterAnalyzerResponse {
  documentos: PosItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  summary: {
    valorTotal: number;
    totalPedidos: number;
  };
}

export class PosListFilterAnalyzerService {
  async execute(
    params: PosListFilterAnalyzerParams = {},
  ): Promise<PosListFilterAnalyzerResponse> {
    const startTime = performance.now();
    let status: "SUCESSO" | "ERRO" = "SUCESSO";

    try {
      const {
        dataEmissaoDe,
        dataEmissaoAte,
        dataVencimentoDe,
        dataVencimentoAte,
        segmento,
        page = 1,
        limit = 20,
        filterModel,
        sortModel,
      } = params;

      const validatedLimit = this.validateLimit(limit);
      const skip = (page - 1) * validatedLimit;

      const queryParams = {
        dataEmissaoDe,
        dataEmissaoAte,
        dataVencimentoDe,
        dataVencimentoAte,
        segmento,
        filterModel,
        sortModel,
      };

      const client = getDotzStageClient();
      const repository = new PosRawQueryRepository();

      // Otimização: calcular aggregate apenas na primeira página
      let totalItems: number;
      let linhas: any[];
      let valorTotal = 0;

      if (page === 1) {
        const [summary, records] = await Promise.all([
          repository.summarize(queryParams),
          repository.findManyDetails(queryParams, skip, validatedLimit),
        ]);

        totalItems = summary.totalItems;
        linhas = records;
        valorTotal = summary.valorTotal;
      } else {
        // Páginas seguintes: buscar APENAS registros (1 query - máxima otimização)
        linhas = await repository.findManyDetails(queryParams, skip, validatedLimit);

        totalItems = 0; // Frontend usa valor da página 1
        // valorTotal permanece 0 para páginas > 1
      }

      const totalPages = page === 1 ? Math.ceil(totalItems / validatedLimit) : 0;
      const parentMap = await PosFormatter.buildParentNameMap(linhas, client);
      const documentos = PosFormatter.formatResponse(linhas, parentMap);
      const totalPedidos = page === 1 ? totalItems : 0;

      return {
        documentos,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: validatedLimit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        summary: {
          valorTotal,
          totalPedidos,
        },
      };
    } catch (error) {
      status = "ERRO";
      throw error;
    } finally {
      log.info("[PosListFilterAnalyzerService.execute] Método finalizado", {
        duracaoMs: Number((performance.now() - startTime).toFixed(2)),
        status,
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      });
    }
  }

  private validateLimit(limit: number): number {
    if (limit < 1) return 1;
    if (limit > 100) return 100;
    return limit;
  }
}
