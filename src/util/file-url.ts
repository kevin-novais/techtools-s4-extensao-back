import { Config } from "@/config/config";

const removeTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const ensureLeadingSlash = (value: string) => (value.startsWith("/") ? value : `/${value}`);

export const buildPublicFileUrl = (fileUrl?: string | null) => {
    if (!fileUrl) {
        return null;
    }

    if (/^https?:\/\//i.test(fileUrl)) {
        return fileUrl;
    }

    const apiUrl = removeTrailingSlash(Config.API_URL);
    const normalizedPath = ensureLeadingSlash(fileUrl);

    return `${apiUrl}${normalizedPath}`;
};
