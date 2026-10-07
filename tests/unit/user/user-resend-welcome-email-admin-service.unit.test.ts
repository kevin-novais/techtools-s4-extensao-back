import { describe, expect, it, vi, beforeEach } from "vitest";

const {
    mockFindUnique,
    mockUpdateUsuario,
    mockSendWelcomeEmail,
    mockGeneratePassword,
    mockBcryptHash,
} = vi.hoisted(() => ({
    mockFindUnique: vi.fn(),
    mockUpdateUsuario: vi.fn(),
    mockSendWelcomeEmail: vi.fn(),
    mockGeneratePassword: vi.fn(),
    mockBcryptHash: vi.fn(),
}));

vi.mock("../../../src/database/clients/s4DotzClient", () => ({
    default: {
        usuario: { findUnique: mockFindUnique, update: mockUpdateUsuario },
    },
}));

vi.mock("../../../src/util/emails/welcomeEmail", () => ({
    sendWelcomeEmail: mockSendWelcomeEmail,
}));

vi.mock("../../../src/util/security/generatePassword", () => ({
    generatePassword: mockGeneratePassword,
}));

vi.mock("bcrypt", () => ({
    default: { hash: mockBcryptHash },
}));

import { UserResendWelcomeEmailAdminService } from "../../../src/modules/user/services/admin/UserResendWelcomeEmailAdminService";

const baseUser = {
    id: 5,
    nome: "Fulano",
    email: "fulano@example.com",
    ativo: true,
};

describe("UserResendWelcomeEmailAdminService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGeneratePassword.mockReturnValue("SenhaGerada123!");
        mockBcryptHash.mockResolvedValue("hash-fake");
        mockSendWelcomeEmail.mockResolvedValue(undefined);
        mockUpdateUsuario.mockResolvedValue({});
    });

    it("deve lançar AppError 404 quando usuário não encontrado", async () => {
        mockFindUnique.mockResolvedValue(null);

        const service = new UserResendWelcomeEmailAdminService();
        await expect(service.execute({ userId: 5 })).rejects.toMatchObject({
            message: "Usuário não encontrado",
            statusCode: 404,
        });

        expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
    });

    it("deve lançar AppError 400 quando usuário está inativo", async () => {
        mockFindUnique.mockResolvedValue({ ...baseUser, ativo: false });

        const service = new UserResendWelcomeEmailAdminService();
        await expect(service.execute({ userId: 5 })).rejects.toMatchObject({
            statusCode: 400,
        });

        expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
        expect(mockUpdateUsuario).not.toHaveBeenCalled();
    });

    it("deve enviar e-mail com senha nova e atualizar o hash no banco", async () => {
        mockFindUnique.mockResolvedValue(baseUser);

        const service = new UserResendWelcomeEmailAdminService();
        const result = await service.execute({ userId: 5 });

        expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                nome: "Fulano",
                email: "fulano@example.com",
                senha: "SenhaGerada123!",
            })
        );
        expect(mockBcryptHash).toHaveBeenCalledWith("SenhaGerada123!", 10);
        expect(mockUpdateUsuario).toHaveBeenCalledWith({
            where: { id: 5 },
            data: expect.objectContaining({ senha: "hash-fake" }),
        });
        expect(result).toMatchObject({ message: expect.any(String) });
    });

    it("não deve alterar a senha do usuário quando o envio do e-mail falha", async () => {
        mockFindUnique.mockResolvedValue(baseUser);
        mockSendWelcomeEmail.mockRejectedValue(new Error("SMTP indisponível"));

        const service = new UserResendWelcomeEmailAdminService();
        await expect(service.execute({ userId: 5 })).rejects.toMatchObject({
            statusCode: 502,
        });

        expect(mockUpdateUsuario).not.toHaveBeenCalled();
    });
});
