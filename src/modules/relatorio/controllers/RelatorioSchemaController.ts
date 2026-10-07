import { Request, Response } from 'express';
import { RelatorioSchemaService } from '@/modules/relatorio/services/RelatorioSchemaService';

export class RelatorioSchemaController {
    async handle(_req: Request, res: Response) {
        const service = new RelatorioSchemaService();
        const result = await service.execute();
        return res.status(200).json(result);
    }
}
