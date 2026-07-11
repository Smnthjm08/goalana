import {
    ScoresService,
    type SSEEvent,
    type ScoresRecord,
} from "@workspace/txline";

const scoresService = new ScoresService();

export async function startScoresWorker() {
    console.log("[scores.worker] Starting...");

    try {
        const stream = await scoresService.streamScoresUpdates();

        console.log("[scores.worker] Connected to TxLINE scores stream");

        for await (const frame of stream as AsyncIterable<SSEEvent>) {
            // Ignore heartbeat
            if (frame.event === "heartbeat") {
                continue;
            }

            // Ignore empty frames
            if (!frame.data?.trim()) {
                continue;
            }

            try {
                const event = JSON.parse(frame.data) as ScoresRecord;

                // Log only useful fields — NOT the whole frame
                console.log("[scores.worker] Score event:", event);
            } catch (error) {
                console.error(
                    "[scores.worker] Failed to parse event:",
                    error,
                );
            }
        }

        console.warn("[scores.worker] Stream ended");
    } catch (error) {
        console.error(
            "[scores.worker] Stream failed:",
            error,
        );
    }
}