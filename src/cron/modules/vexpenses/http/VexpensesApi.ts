import axios from "axios";
import { Config } from "@/config/config";
import {
  VexpensesCostCenter,
  VexpensesExpenseType,
  VexpensesPayReportPayload,
  VexpensesReport,
  VexpensesReportStatus,
  VexpensesReportWithExpenses,
  VexpensesTeamMember,
} from "@/cron/modules/vexpenses/types/expenses.types";

type VexpensesReportStatusParams = {
  search?: string;
  searchFields?: string;
};

export class VexpensesApi {
  async baseApi() {
    const token = Config.VEXPENSES_TOKEN_API;
    const url = Config.VEXPENSES_BASE_URL;
    return axios.create({
      baseURL: url,
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
      },
    });
  }

  async getTeamMembers(): Promise<VexpensesTeamMember[]> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesTeamMember[] }>("/team-members");
    return response.data.data;
  }

  async getTeamMember(user_id: number): Promise<VexpensesTeamMember | null> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesTeamMember | VexpensesTeamMember[] }>(`/team-members/${user_id}`);
    const payload = response.data.data;

    if (Array.isArray(payload)) {
      return payload[0] ?? null;
    }

    return payload ?? null;
  }

  async getExpenseTypes(): Promise<VexpensesExpenseType[]> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesExpenseType[] }>("/expenses-type");
    return response.data.data;
  }

  async getCostCenters(): Promise<VexpensesCostCenter[]> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesCostCenter[] }>("/costs-centers");
    return response.data.data;
  }

  async getCostCenter(id: number): Promise<VexpensesCostCenter | null> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesCostCenter | VexpensesCostCenter[] }>(`/costs-centers/${id}`);
    const payload = response.data.data;

    if (Array.isArray(payload)) {
      return payload[0] ?? null;
    }

    return payload ?? null;
  }

  async getReports(): Promise<VexpensesReport[]> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesReport[] }>("/reports");
    return response.data.data;
  }

  async getReport(id: number): Promise<VexpensesReport> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesReport }>(`/reports/${id}`);
    return response.data.data;
  }

  // status: ABERTO, APROVADO, REPROVADO, PAGO, ENVIADO
  async getReportStatus(status: VexpensesReportStatus, params?: VexpensesReportStatusParams): Promise<VexpensesReport[]> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesReport[] }>(`/reports/status/${status}`, {
      params,
    });
    return response.data.data;
  }

  async getReportExpenses(id: number): Promise<VexpensesReportWithExpenses> {
    const baseApi = await this.baseApi();
    const response = await baseApi.get<{ data: VexpensesReportWithExpenses }>(`/reports/${id}?include=expenses`);
    return response.data.data;
  }

  async payReport(reportId: number, payload: VexpensesPayReportPayload): Promise<void> {
    const baseApi = await this.baseApi();
    await baseApi.put(`/reports/${reportId}/pay`, payload);
  }
}