import { formatMonthYear } from "@/util/date";

describe("formatMonthYear", () => {
  it("formata o mês em português e caixa alta", () => {
    expect(formatMonthYear(new Date("2026-07-01T00:00:00.000Z"))).toBe("JULHO/2026");
  });

  it("preserva o mês UTC na virada do ano", () => {
    expect(formatMonthYear(new Date("2026-01-01T00:00:00.000Z"))).toBe("JANEIRO/2026");
    expect(formatMonthYear(new Date("2026-12-31T23:59:59.999Z"))).toBe("DEZEMBRO/2026");
  });

  it("rejeita uma data inválida", () => {
    expect(() => formatMonthYear(new Date("invalid"))).toThrow(TypeError);
  });
});
