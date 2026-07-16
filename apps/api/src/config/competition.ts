import { FixtureService } from "@workspace/txline";
import { logger } from "../utils/logger";

// The product default. World Cup stays "the product" — this is preferred
// whenever it has any viable (upcoming) fixture, regardless of what else
// the subscription bundle grants.
export const WORLD_CUP_COMPETITION_ID = 72;

const fixtureService = new FixtureService();

// Resolved once per process and cached for the rest of its lifetime — mirrors
// the module-level singleton pattern used for the Solana connection in
// goalana.service.ts. Re-resolving per-call would mean cron ticks could
// disagree with each other mid-run if TxLINE's bundle contents ever shifted.
let cachedCompetitionId: number | null = null;
let inFlight: Promise<number> | null = null;

interface CompetitionCandidate {
    competitionId: number;
    name: string;
    fixtureCount: number;
    soonestUpcomingStart: number | null; // epoch ms, or null if nothing upcoming
}

async function discoverActiveCompetitionId(): Promise<number> {
    const now = Date.now();

    // The only legitimate discovery signal TxLINE exposes: omit the
    // competitionId filter and see what the current bundle actually returns.
    // There is no "list competitions" endpoint, and probing arbitrary IDs
    // 403s ("Competition N is not in your bundle") — confirmed live.
    const fixtures = await fixtureService.getAllFixtureSnapshots();

    const byCompetition = new Map<number, CompetitionCandidate>();
    for (const fixture of fixtures) {
        const id = fixture.CompetitionId;
        const startTime = Number(fixture.StartTime);
        const existing = byCompetition.get(id);

        if (!existing) {
            byCompetition.set(id, {
                competitionId: id,
                name: fixture.Competition,
                fixtureCount: 1,
                soonestUpcomingStart: startTime > now ? startTime : null,
            });
            continue;
        }

        existing.fixtureCount += 1;
        if (startTime > now && (existing.soonestUpcomingStart === null || startTime < existing.soonestUpcomingStart)) {
            existing.soonestUpcomingStart = startTime;
        }
    }

    const candidates = Array.from(byCompetition.values()).sort((a, b) => {
        if (a.soonestUpcomingStart === null) return 1;
        if (b.soonestUpcomingStart === null) return -1;
        return a.soonestUpcomingStart - b.soonestUpcomingStart;
    });

    logger.info(
        "competition.config",
        `Bundle discovery ranking: ${candidates
            .map((c) => {
                const eta = c.soonestUpcomingStart
                    ? `${Math.round((c.soonestUpcomingStart - now) / 3_600_000)}h`
                    : "none upcoming";
                return `${c.name} (${c.competitionId}): ${c.fixtureCount} fixtures, soonest upcoming ${eta}`;
            })
            .join("; ")}`
    );

    const worldCup = byCompetition.get(WORLD_CUP_COMPETITION_ID);
    if (worldCup?.soonestUpcomingStart != null) {
        logger.success(
            "competition.config",
            `World Cup (${WORLD_CUP_COMPETITION_ID}) has an upcoming fixture — keeping it as the active competition.`
        );
        return WORLD_CUP_COMPETITION_ID;
    }

    const fallback = candidates.find((c) => c.soonestUpcomingStart !== null);
    if (fallback) {
        const etaHours = Math.round((fallback.soonestUpcomingStart! - now) / 3_600_000);
        logger.warn(
            "competition.config",
            `World Cup has no upcoming fixtures; selected competition ${fallback.competitionId} '${fallback.name}' — soonest fixture in ${etaHours}h`
        );
        return fallback.competitionId;
    }

    logger.warn(
        "competition.config",
        `No competition in the bundle has an upcoming fixture. Falling back to World Cup (${WORLD_CUP_COMPETITION_ID}) as the default.`
    );
    return WORLD_CUP_COMPETITION_ID;
}

export async function getActiveCompetitionId(): Promise<number> {
    if (cachedCompetitionId != null) {
        return cachedCompetitionId;
    }

    const envValue = process.env.COMPETITION_ID;
    if (envValue) {
        const parsed = Number.parseInt(envValue, 10);
        if (Number.isNaN(parsed)) {
            throw new Error(`Invalid COMPETITION_ID env value: "${envValue}"`);
        }
        logger.info("competition.config", `Using explicit COMPETITION_ID=${parsed}`);
        cachedCompetitionId = parsed;
        return cachedCompetitionId;
    }

    if (!inFlight) {
        inFlight = discoverActiveCompetitionId()
            .then((id) => {
                cachedCompetitionId = id;
                return id;
            })
            .finally(() => {
                inFlight = null;
            });
    }

    return inFlight;
}
