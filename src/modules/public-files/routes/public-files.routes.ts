import { Router } from "express";
import { PublicFileDownloadController } from "@/modules/public-files/controllers/PublicFileDownloadController";

const publicFilesRoutes = Router();
const controller = new PublicFileDownloadController();

publicFilesRoutes.get("/:filename", controller.handle.bind(controller));

export default publicFilesRoutes;
