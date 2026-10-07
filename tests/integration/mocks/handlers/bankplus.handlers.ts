import { http, HttpResponse } from "msw";

const BANKPLUS_BASE_URL = process.env.BANKPLUS_INVENT_BASE_URL || "http://fake-bankplus.invalid";

export const bankplusHandlers = [
    http.post(`${BANKPLUS_BASE_URL}/authenticate`, () =>
        HttpResponse.json({
            token: "fake-bankplus-token",
            expiresIn: Math.floor(Date.now() / 1000) + 3600,
        }),
    ),
    http.get(`${BANKPLUS_BASE_URL}/api/cobranca/pdfs`, () =>
        HttpResponse.json({ pdf: "JVBERi0xLjQKJeLjz9MK", fileName: "boleto-fake.pdf" }),
    ),
];
