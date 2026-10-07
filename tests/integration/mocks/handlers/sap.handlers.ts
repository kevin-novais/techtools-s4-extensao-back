import { http, HttpResponse } from "msw";
import sapRegistrosFixture from "../fixtures/sap-registros-contabeis.json";

const SAP_AUTH_URL = process.env.S4_HANA_CLOUD_AUTH_URL || "http://fake-sap-auth.invalid";
const SAP_BASE_URL = process.env.S4_HANA_CLOUD_BASE_URL || "http://fake-sap.invalid";

export const sapHandlers = [
    http.post(`${SAP_AUTH_URL}/oauth/token`, () =>
        HttpResponse.json({
            access_token: "fake-sap-access-token",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "test",
            jti: "fake-jti",
        }),
    ),

    http.get(`${SAP_BASE_URL}/http/getJournalEntries`, ({ request }) => {
        const url = new URL(request.url);
        const skip = Number(url.searchParams.get("Skip") ?? 0);
        const top = Number(url.searchParams.get("Top") ?? 100);
        const items = sapRegistrosFixture.slice(skip, skip + top);

        return HttpResponse.json(items, {
            headers: {
                "total-itens": String(sapRegistrosFixture.length),
            },
        });
    }),

    http.post(`${SAP_BASE_URL}/sap/opu/odata/sap/API_JOURNALENTRYBULKCREATE_SRV/JournalEntryBulkCreate`, () =>
        HttpResponse.json({ d: { results: [] } }),
    ),

    http.get(`${SAP_BASE_URL}/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner`, () =>
        HttpResponse.json({ d: { results: [] } }),
    ),
];
