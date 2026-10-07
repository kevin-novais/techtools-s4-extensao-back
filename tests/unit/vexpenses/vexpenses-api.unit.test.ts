import axios from "axios";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { VexpensesApi } from "../../../src/cron/modules/vexpenses/http/VexpensesApi";

vi.mock("axios", () => ({
  default: {
    create: vi.fn(),
  },
}));

describe("VexpensesApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve enviar pagamento de report no endpoint /reports/{id}/pay", async () => {
    const putMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.mocked(axios.create).mockReturnValue({
      put: putMock,
    } as any);

    const api = new VexpensesApi();
    await api.payReport(123, {
      payment_date: "2026-03-02 10:00:00",
      comment: "Pagamento automatico",
    });

    expect(putMock).toHaveBeenCalledWith("/reports/123/pay", {
      payment_date: "2026-03-02 10:00:00",
      comment: "Pagamento automatico",
    });
  });

  it("deve retornar o team member quando a API responder data como objeto (não array)", async () => {
    const getMock = vi.fn().mockResolvedValue({
      data: {
        data: {
          id: 1150761,
          integration_id: "1000075",
          name: "ANA BEATRIZ PINHEIRO GUERRA",
          parameters: { base: null },
        },
      },
    });
    vi.mocked(axios.create).mockReturnValue({
      get: getMock,
    } as any);

    const api = new VexpensesApi();
    const result = await api.getTeamMember(1150761);

    expect(getMock).toHaveBeenCalledWith("/team-members/1150761");
    expect(result?.integration_id).toBe("1000075");
  });

  it("deve retornar o primeiro team member quando a API responder data como array", async () => {
    const getMock = vi.fn().mockResolvedValue({
      data: {
        data: [{ id: 1150761, integration_id: "1000075", parameters: { base: "1410" } }],
      },
    });
    vi.mocked(axios.create).mockReturnValue({
      get: getMock,
    } as any);

    const api = new VexpensesApi();
    const result = await api.getTeamMember(1150761);

    expect(result?.integration_id).toBe("1000075");
    expect(result?.parameters?.base).toBe("1410");
  });

  it("deve retornar o primeiro cost center quando a API responder data como array", async () => {
    const getMock = vi.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: 1778742,
            integration_id: "912.1000",
            name: "912.1000",
            company_group_id: 51384,
            on: true,
            approval_flow_id: 166109,
          },
        ],
      },
    });
    vi.mocked(axios.create).mockReturnValue({
      get: getMock,
    } as any);

    const api = new VexpensesApi();
    const result = await api.getCostCenter(1778742);

    expect(getMock).toHaveBeenCalledWith("/costs-centers/1778742");
    expect(result?.integration_id).toBe("912.1000");
  });
});

