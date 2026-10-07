import s4DotzClient from "@/database/clients/s4DotzClient";
import jwt from 'jsonwebtoken';
import bcrypt from "bcrypt";
import AppError from "@/util/AppError";
import { Config } from "@/config/config";

interface AuthSessionServiceProps {
    email: string;
    password: string;
}
export class AuthSessionService {
    async execute({ email, password }: AuthSessionServiceProps) {
        const user = await s4DotzClient.usuario.findUnique({
            where: {
                email
            },
            select: {
                id: true,
                email: true,
                senha: true,
                perfil: true
            }
        })

        if (!user) {
            throw new AppError("Usuário não encontrado", 404);
        }

        const valid = await bcrypt.compare(password, user.senha);
        if (!valid) {
            throw new AppError("Credenciais inválidas", 401);
        }

        const accessToken = jwt.sign(
            { id: user.id},
            Config.ACCESS_TOKEN_SECRET,
            { expiresIn: "15d"}
        );
        

        return accessToken;

    }
}