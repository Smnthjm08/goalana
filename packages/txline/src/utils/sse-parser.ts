import { Transform, type TransformCallback } from "stream";

/**
 * A parsed SSE event with raw string fields.
 * JSON parsing of `data` is intentionally left to the caller
 * so this parser stays generic and reusable.
 */
export interface SSEEvent {
    /** The SSE `id:` field, if present. */
    id?: string;
    /** The SSE `event:` field (e.g. "heartbeat"). Undefined for default "message" events. */
    event?: string;
    /** The raw `data:` payload string. May span multiple `data:` lines, joined with "\n". */
    data: string;
}

/**
 * Transform stream that parses raw SSE byte chunks into `SSEEvent` objects.
 *
 * Implements the SSE parsing algorithm per:
 * https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream
 *
 * - Buffers incomplete lines across TCP packet boundaries
 * - Recognises `id:`, `event:`, `data:` fields and the blank-line dispatch trigger
 * - Ignores `:comment` lines (often used as keep-alives)
 * - Operates in objectMode on the readable side — push() emits SSEEvent objects
 *
 * @example
 * ```ts
 * const parser = new SSEParser();
 * rawStream.pipe(parser);
 * parser.on("data", (evt: SSEEvent) => {
 *   console.log(evt.id, evt.event, evt.data);
 * });
 * ```
 */
export class SSEParser extends Transform {
    private lineBuffer = "";
    private eventId: string | undefined;
    private eventType: string | undefined;
    private dataLines: string[] = [];

    constructor() {
        super({ readableObjectMode: true });
    }

    override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
        // Append raw bytes as UTF-8 to the line buffer
        this.lineBuffer += chunk.toString("utf-8");

        // Split on any combination of \r\n, \r, or \n (SSE spec allows all three)
        const lines = this.lineBuffer.split(/\r\n|\r|\n/);

        // The last element may be an incomplete line — keep it in the buffer
        this.lineBuffer = lines.pop()!;

        for (const line of lines) {
            this.processLine(line);
        }

        callback();
    }

    override _flush(callback: TransformCallback): void {
        // Process any remaining buffered content
        if (this.lineBuffer.length > 0) {
            this.processLine(this.lineBuffer);
            this.lineBuffer = "";
        }
        // Dispatch any pending event
        this.dispatchEvent();
        callback();
    }

    private processLine(line: string): void {
        // Blank line → dispatch the accumulated event
        if (line === "") {
            this.dispatchEvent();
            return;
        }

        // Comment lines start with `:` — ignore them
        if (line.startsWith(":")) {
            return;
        }

        // Split into field:value. If no colon, the whole line is the field with empty value.
        const colonIdx = line.indexOf(":");
        let field: string;
        let value: string;

        if (colonIdx === -1) {
            field = line;
            value = "";
        } else {
            field = line.slice(0, colonIdx);
            // Per spec: if there's a space after the colon, strip it (only the first space)
            value = line.slice(colonIdx + 1);
            if (value.startsWith(" ")) {
                value = value.slice(1);
            }
        }

        switch (field) {
            case "id":
                this.eventId = value;
                break;
            case "event":
                this.eventType = value;
                break;
            case "data":
                this.dataLines.push(value);
                break;
            // "retry" and unknown fields are ignored per spec
        }
    }

    private dispatchEvent(): void {
        // Only dispatch if we have at least one data line
        if (this.dataLines.length === 0) {
            // Reset type/id state even if no data (per spec)
            this.eventType = undefined;
            return;
        }

        const event: SSEEvent = {
            data: this.dataLines.join("\n"),
        };

        if (this.eventId !== undefined) {
            event.id = this.eventId;
        }
        if (this.eventType !== undefined) {
            event.event = this.eventType;
        }

        this.push(event);

        // Reset per-event state
        this.dataLines = [];
        this.eventType = undefined;
        // Note: id is sticky per SSE spec — it persists until overwritten.
        // But for our use-case we reset it so each emitted event only carries
        // the id that was explicitly set for that event block.
        this.eventId = undefined;
    }
}
