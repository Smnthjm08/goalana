import { describe, it, expect } from "bun:test";
import { PassThrough } from "stream";
import { SSEParser, parseSseTextToPayloads, type SSEEvent } from "../utils/sse-parser";

/** Helper: collect all SSEEvent objects emitted by a parser. */
function collectEvents(parser: SSEParser): Promise<SSEEvent[]> {
    return new Promise((resolve, reject) => {
        const events: SSEEvent[] = [];
        parser.on("data", (evt: SSEEvent) => events.push(evt));
        parser.on("end", () => resolve(events));
        parser.on("error", reject);
    });
}

describe("SSEParser", () => {
    it("parses a single complete SSE frame", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        parser.write(Buffer.from('id: 123\nevent: message\ndata: {"foo":"bar"}\n\n'));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.id).toBe("123");
        expect(events[0]!.event).toBe("message");
        expect(events[0]!.data).toBe('{"foo":"bar"}');
    });

    it("parses multiple frames in a single chunk", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        parser.write(Buffer.from(
            'data: first\n\ndata: second\n\n'
        ));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(2);
        expect(events[0]!.data).toBe("first");
        expect(events[1]!.data).toBe("second");
    });

    it("handles frames split across multiple chunks", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        // Split "id: 42\ndata: hello\n\n" across two writes
        parser.write(Buffer.from("id: 42\nda"));
        parser.write(Buffer.from("ta: hello\n\n"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.id).toBe("42");
        expect(events[0]!.data).toBe("hello");
    });

    it("ignores comment lines (keep-alive)", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        parser.write(Buffer.from(": this is a comment\ndata: real\n\n"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.data).toBe("real");
    });

    it("handles heartbeat events with event: heartbeat", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        parser.write(Buffer.from('event: heartbeat\ndata: \n\n'));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.event).toBe("heartbeat");
        expect(events[0]!.data).toBe("");
    });

    it("joins multiple data lines with newline", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        parser.write(Buffer.from("data: line1\ndata: line2\ndata: line3\n\n"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.data).toBe("line1\nline2\nline3");
    });

    it("strips a single leading space from field values", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        // "data:  two spaces" → only first space stripped → " two spaces"
        parser.write(Buffer.from("data:  two spaces\n\n"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.data).toBe(" two spaces");
    });

    it("handles \\r\\n line endings", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        parser.write(Buffer.from("data: crlf\r\n\r\n"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.data).toBe("crlf");
    });

    it("handles \\r line endings", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        parser.write(Buffer.from("data: cr\r\r"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.data).toBe("cr");
    });

    it("does not emit when there is no data field", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        // An event block with only id and event but no data → should not dispatch
        parser.write(Buffer.from("id: 99\nevent: ping\n\n"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(0);
    });

    it("flushes a pending event on stream end", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        // Write a frame without the trailing blank line
        parser.write(Buffer.from("data: no-trailing-newline"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.data).toBe("no-trailing-newline");
    });

    it("works with piped PassThrough stream", async () => {
        const source = new PassThrough();
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        source.pipe(parser);

        source.write(Buffer.from("id: 1\ndata: piped\n\n"));
        source.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.id).toBe("1");
        expect(events[0]!.data).toBe("piped");
    });

    it("handles fields with no value (no colon)", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        // "data" with no colon → field="data", value=""
        parser.write(Buffer.from("data\n\n"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.data).toBe("");
    });
});

describe("parseSseTextToPayloads", () => {
    it("recovers JSON payloads from a buffered SSE-formatted text blob", () => {
        const text = 'data: {"FixtureId":1,"Seq":1}\n\ndata: {"FixtureId":1,"Seq":2}\n\n';
        const payloads = parseSseTextToPayloads<{ FixtureId: number; Seq: number }>(text);

        expect(payloads).toHaveLength(2);
        expect(payloads[0]).toEqual({ FixtureId: 1, Seq: 1 });
        expect(payloads[1]).toEqual({ FixtureId: 1, Seq: 2 });
    });

    it("skips non-JSON / comment-only blocks instead of throwing", () => {
        const text = ': keep-alive\n\ndata: {"FixtureId":1,"Seq":1}\n\nevent: heartbeat\ndata: \n\n';
        const payloads = parseSseTextToPayloads<{ FixtureId: number; Seq: number }>(text);

        expect(payloads).toHaveLength(1);
        expect(payloads[0]).toEqual({ FixtureId: 1, Seq: 1 });
    });

    it("returns an empty array for a plain (non-SSE) JSON string", () => {
        // Guards the original failure mode: if this were spread with `[...text]`
        // instead of parsed, it would silently produce one bogus entry per
        // character rather than zero.
        const payloads = parseSseTextToPayloads("not sse data at all");
        expect(payloads).toEqual([]);
    });

    it("handles fields with no value (no colon)", async () => {
        const parser = new SSEParser();
        const collecting = collectEvents(parser);

        // "data" with no colon → field="data", value=""
        parser.write(Buffer.from("data\n\n"));
        parser.end();

        const events = await collecting;
        expect(events).toHaveLength(1);
        expect(events[0]!.data).toBe("");
    });
});
