import { vi } from "vitest";

export const sendMailMock = vi.fn().mockResolvedValue({ messageId: "fake-message-id" });

vi.mock("nodemailer", () => {
    const transporter = { sendMail: sendMailMock, verify: vi.fn().mockResolvedValue(true) };
    return {
        default: { createTransport: vi.fn(() => transporter) },
        createTransport: vi.fn(() => transporter),
    };
});
