import axios from "axios";

export const txlineClient = axios.create({
    timeout: 30_000,
    headers: {
        "Content-Type": "application/json",
    },
});

// Resolve env vars lazily at request time — not at module load time.
// This avoids the race where `import` runs before `dotenv.config()`.
txlineClient.interceptors.request.use((config) => {
    if (!config.baseURL) {
        config.baseURL = process.env.TXLINE_API_ORIGIN;
    }
    if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${process.env.TXLINE_JWT}`;
    }
    if (!config.headers["X-Api-Token"]) {
        config.headers["X-Api-Token"] = process.env.TXLINE_API_TOKEN;
    }
    return config;
});