import { describe, expect, it, vi, beforeEach } from "vitest";
import { ensureApiKey } from "../../../src/middlewares/ensure-apikey";
import AppError from "../../../src/util/AppError";

let appApiKeyValue: string | undefined = "expected-api-key-123";
vi.mock("../../../src/config/config", () => ({
  Config: {
    get APP_API_KEY() {
      return appApiKeyValue;
    },
  },
}));

const createMockRequest = (headers: Record<string, string> = {}) =>
  ({
    headers,
    ip: "127.0.0.1",
  }) as any;

const createMockResponse = () => ({} as any);

const createMockNext = () => vi.fn();

describe("ensureApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appApiKeyValue = "expected-api-key-123";
  });

  it("deve chamar next() quando Authorization Bearer com token válido", () => {
    const req = createMockRequest({ authorization: "Bearer expected-api-key-123" });
    const res = createMockResponse();
    const next = createMockNext();

    ensureApiKey(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("deve lançar AppError 401 quando Authorization não informado", () => {
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = createMockNext();

    expect(() => ensureApiKey(req, res, next)).toThrow(AppError);
    expect(() => ensureApiKey(req, res, next)).toThrow("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  it("deve lançar AppError 401 quando Authorization sem prefixo Bearer", () => {
    const req = createMockRequest({ authorization: "expected-api-key-123" });
    const res = createMockResponse();
    const next = createMockNext();

    expect(() => ensureApiKey(req, res, next)).toThrow(AppError);
    expect(() => ensureApiKey(req, res, next)).toThrow("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  it("deve lançar AppError 401 quando Bearer vazio", () => {
    const req = createMockRequest({ authorization: "Bearer " });
    const res = createMockResponse();
    const next = createMockNext();

    expect(() => ensureApiKey(req, res, next)).toThrow(AppError);
    expect(() => ensureApiKey(req, res, next)).toThrow("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  it("deve lançar AppError 401 quando Bearer com token inválido", () => {
    const req = createMockRequest({ authorization: "Bearer wrong-token" });
    const res = createMockResponse();
    const next = createMockNext();

    expect(() => ensureApiKey(req, res, next)).toThrow(AppError);
    expect(() => ensureApiKey(req, res, next)).toThrow("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  it("deve lançar AppError 401 quando formato Basic (não Bearer)", () => {
    const req = createMockRequest({ authorization: "Basic dXNlcjpwYXNz" });
    const res = createMockResponse();
    const next = createMockNext();

    expect(() => ensureApiKey(req, res, next)).toThrow(AppError);
    expect(() => ensureApiKey(req, res, next)).toThrow("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  it("deve lançar AppError 500 quando APP_API_KEY não configurado", () => {
    appApiKeyValue = undefined;

    const req = createMockRequest({ authorization: "Bearer expected-api-key-123" });
    const res = createMockResponse();
    const next = createMockNext();

    expect(() => ensureApiKey(req, res, next)).toThrow(AppError);
    expect(() => ensureApiKey(req, res, next)).toThrow("Internal server error");
    expect(next).not.toHaveBeenCalled();
  });
});
