import dotenv from "dotenv";
dotenv.config();

import { Storage } from "@google-cloud/storage";

const bucket = process.env.GCS_BUCKET_NAME ?? "";
const projectId = process.env.GCS_PROJECT_ID || undefined;
const emulatorHost = process.env.GCS_EMULATOR_HOST ?? "";

if (!bucket) {
    console.error("❌ GCS_BUCKET_NAME não está definido no .env");
    process.exit(1);
}

async function main() {
    const modo = emulatorHost ? `emulador (${emulatorHost})` : "GCP real (GOOGLE_APPLICATION_CREDENTIALS)";
    console.log(`\nTestando conexão com GCS [${modo}]...`);
    console.log(`  Bucket: ${bucket}`);
    console.log();

    const storage = new Storage({
        projectId,
        ...(emulatorHost && { apiEndpoint: `http://${emulatorHost}` }),
    });

    // 1. Upload de arquivo de teste
    const testContent = `teste-gcs-${Date.now()}`;
    const testFileName = `test/connection-check-${Date.now()}.txt`;

    try {
        await storage.bucket(bucket).file(testFileName).save(testContent, {
            contentType: "text/plain",
        });
        console.log(`✅ Upload realizado: ${testFileName}`);
    } catch (err: any) {
        console.error(`❌ Erro no upload: ${err.message}`);
        process.exit(1);
    }

    // 2. Download para confirmar
    try {
        const [downloaded] = await storage.bucket(bucket).file(testFileName).download();
        if (downloaded.toString() !== testContent) throw new Error("Conteúdo divergente após download");
        console.log(`✅ Download confirmado.`);
    } catch (err: any) {
        console.error(`❌ Erro no download: ${err.message}`);
    }

    // 3. Remove arquivo de teste
    try {
        await storage.bucket(bucket).file(testFileName).delete();
        console.log(`✅ Arquivo de teste removido.`);
    } catch (err: any) {
        console.warn(`⚠️  Não foi possível remover o arquivo de teste: ${err.message}`);
    }

    console.log(`\n✅ GCS configurado corretamente!\n`);
}

main().catch((err) => {
    console.error("Erro inesperado:", err);
    process.exit(1);
});
