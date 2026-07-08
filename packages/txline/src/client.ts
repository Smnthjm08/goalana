import axios from "axios";

export const TXLINE_CONFIG = {
    baseUrl: process.env.TXLINE_API_ORIGIN,
    timeout: 30000,
};

export const txlineClient = axios.create({
    baseURL: TXLINE_CONFIG.baseUrl,
    timeout: TXLINE_CONFIG.timeout,
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.TXLINE_JWT}`,
        "X-Api-Token": process.env.TXLINE_API_TOKEN
    },
});