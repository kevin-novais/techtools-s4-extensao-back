import DatabaseManager from "@/database/DatabaseManager";

const getDotzStageClient = () => {
  return DatabaseManager.getDotzStageClient();
};

export default getDotzStageClient;

