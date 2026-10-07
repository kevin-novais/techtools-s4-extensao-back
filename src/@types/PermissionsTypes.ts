export const Perfil = {
    ADMIN: "ADMIN",
    USER: "USER",
  } as const;

export type Perfil = typeof Perfil[keyof typeof Perfil];