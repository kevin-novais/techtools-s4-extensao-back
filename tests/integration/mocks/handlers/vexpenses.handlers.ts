import { http, HttpResponse } from "msw";

const VEXPENSES_BASE_URL = process.env.VEXPENSES_BASE_URL || "http://fake-vexpenses.invalid";

export const vexpensesHandlers = [
    http.get(`${VEXPENSES_BASE_URL}/team-members`, () => HttpResponse.json({ data: [] })),
    http.get(`${VEXPENSES_BASE_URL}/team-members/:id`, () => HttpResponse.json({ data: [] })),
    http.get(`${VEXPENSES_BASE_URL}/expenses-type`, () => HttpResponse.json({ data: [] })),
    http.get(`${VEXPENSES_BASE_URL}/costs-centers`, () => HttpResponse.json({ data: [] })),
    http.get(`${VEXPENSES_BASE_URL}/costs-centers/:id`, () => HttpResponse.json({ data: null })),
    http.get(`${VEXPENSES_BASE_URL}/reports`, () => HttpResponse.json({ data: [] })),
    http.get(`${VEXPENSES_BASE_URL}/reports/:id`, () => HttpResponse.json({ data: { expenses: [] } })),
    http.get(`${VEXPENSES_BASE_URL}/reports/status/:status`, () => HttpResponse.json({ data: [] })),
    http.put(`${VEXPENSES_BASE_URL}/v2/reports/:id/pay`, () => HttpResponse.json({})),
];
