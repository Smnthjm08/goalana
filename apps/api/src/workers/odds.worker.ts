import {
    OddsService,
    type SSEEvent,
    type OddsPayload,
} from "@workspace/txline";
import { processOddsUpdate } from "./odds.processor";

const oddsService = new OddsService();

export async function startOddsWorker() {
    console.log("[odds.worker] Starting...");

    try {
        const stream = await oddsService.streamOddsUpdates();

        console.log("[odds.worker] Connected to TxLINE odds stream");

        for await (const frame of stream as AsyncIterable<SSEEvent>) {
            // Ignore heartbeat
            if (frame.event === "heartbeat") {
                continue;
            }

            // Ignore empty frames
            if (!frame.data?.trim()) {
                continue;
            }

            let event: OddsPayload;

            try {
                event = JSON.parse(frame.data) as OddsPayload;
            } catch (error) {
                console.error(
                    "[odds.worker] Failed to parse event:",
                    error,
                );
                continue;
            }

            await processOddsUpdate(event);
        }

        console.warn("[odds.worker] Stream ended");
    } catch (error) {
        console.error(
            "[odds.worker] Stream failed:",
            error,
        );
    }
}
