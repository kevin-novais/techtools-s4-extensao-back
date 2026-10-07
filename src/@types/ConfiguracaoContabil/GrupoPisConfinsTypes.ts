export const GrupoPisConfinsTypes = {
    S: "S",
    N: "N",
} as const;

export type GrupoPisConfinsTypes = typeof GrupoPisConfinsTypes[keyof typeof GrupoPisConfinsTypes];