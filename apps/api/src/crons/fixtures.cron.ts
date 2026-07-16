import { prisma, Prisma } from "@workspace/db";
import { FixtureService } from "@workspace/txline";
import cron from "node-cron";
import { syncOdds } from "./odds.cron";
import { backfillFixtureScores } from "../workers/scores.backfill";
import { logger } from "../utils/logger";
import { getActiveCompetitionId } from "../config/competition";

let isSnapshotSyncRunning = false;
let isUpdateSyncRunning = false;
let isBatchValidationSyncRunning = false;

export interface SyncResult {
    success: boolean;
    reason?: string;
}

export async function syncFixtures(): Promise<SyncResult> {
    if (isSnapshotSyncRunning) {
        logger.warn(
            "fixture.cron",
            "Snapshot sync already running. Skipping."
        );
        return { success: false, reason: "sync_already_running" };
    }

    isSnapshotSyncRunning = true;
    logger.info("fixture.cron", "Starting fixture sync...");

    try {
        const fixtureService = new FixtureService();
        const competitionId = await getActiveCompetitionId();
        const fixtures = await fixtureService.getFixtureSnapshot(undefined, competitionId);

        if (!fixtures || fixtures.length === 0) {
            logger.warn("fixture.cron", "No fixtures returned from TxLINE.");
            // A genuinely empty snapshot is not a failure — don't conflate it with an API error.
            return { success: true };
        }

        for (const fixture of fixtures) {
            const fixtureId = BigInt(fixture.FixtureId);
            const ts = BigInt(fixture.Ts);

            const data = {
                ts,
                startTime: BigInt(fixture.StartTime),
                competition: fixture.Competition,
                competitionId: fixture.CompetitionId,
                fixtureGroupId: fixture.FixtureGroupId,
                participant1Id: fixture.Participant1Id,
                participant1: fixture.Participant1,
                participant2Id: fixture.Participant2Id,
                participant2: fixture.Participant2,
                participant1IsHome: fixture.Participant1IsHome,
                gameState: fixture.GameState ?? null,
            };

            await prisma.$transaction(async (tx) => {
                const current = await tx.fixture.findUnique({
                    where: { fixtureId },
                    select: { ts: true },
                });

                if (!current) {
                    await tx.fixture.create({
                        data: {
                            fixtureId,
                            ...data,
                        },
                    });

                    // Newly-tracked fixture: reconcile any scores history it
                    // already has (e.g. a fixture that was already in-play
                    // when Goalana started tracking it) through the same
                    // canonical processor the live scores worker uses.
                    // Fire-and-forget — must not block fixture sync.
                    void backfillFixtureScores(fixture.FixtureId).catch((error) => {
                        logger.error(
                            "fixture.cron",
                            `Scores backfill failed for new fixture ${fixture.FixtureId}`,
                            error,
                        );
                    });
                } else if (ts > current.ts) {
                    await tx.fixture.update({
                        where: { fixtureId },
                        data,
                    });
                }
            });
        }

        logger.success(
            "fixture.cron",
            `Successfully synced ${fixtures.length} fixtures.`
        );

        // Chain odds sync after successful fixture sync
        await syncOdds();

        return { success: true };
    } catch (error) {
        logger.error("fixture.cron", "Fixture sync failed", error);
        return {
            success: false,
            reason: error instanceof Error ? error.message : "unknown_error",
        };
    } finally {
        isSnapshotSyncRunning = false;
    }
}

export async function syncFixtureUpdates() {
    if (isUpdateSyncRunning) {
        logger.warn("fixture.cron", "Update sync already running. Skipping.");
        return;
    }

    isUpdateSyncRunning = true;
    logger.info("fixture.cron", "Starting fixture updates sync...");

    try {
        const fixtureService = new FixtureService();
        const competitionId = await getActiveCompetitionId();

        const now = new Date();
        const epochDay = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
        const hourOfDay = now.getUTCHours();

        const currentFixtures =
            (await fixtureService.getFixtureUpdates(epochDay, hourOfDay)) ?? [];

        let previousFixtures: typeof currentFixtures = [];

        if (hourOfDay > 0) {
            previousFixtures =
                (await fixtureService.getFixtureUpdates(epochDay, hourOfDay - 1)) ?? [];
        } else {
            previousFixtures =
                (await fixtureService.getFixtureUpdates(epochDay - 1, 23)) ?? [];
        }

        // Deduplicate by actual update identity
        const updateMap = new Map<string, typeof currentFixtures[number]>();

        for (const fixture of [...previousFixtures, ...currentFixtures]) {
            const key = `${fixture.FixtureId}:${fixture.Ts}`;
            updateMap.set(key, fixture);
        }

        const fixtures = Array.from(updateMap.values())
            .filter((fixture) => fixture.CompetitionId === competitionId)
            .sort((a, b) => {
                const aTs = BigInt(a.Ts);
                const bTs = BigInt(b.Ts);

                return aTs < bTs ? -1 : aTs > bTs ? 1 : 0;
            });

        if (fixtures.length === 0) {
            return;
        }

        for (const fixture of fixtures) {
            const fixtureId = BigInt(fixture.FixtureId);
            const ts = BigInt(fixture.Ts);

            const data = {
                ts,
                startTime: BigInt(fixture.StartTime),
                competition: fixture.Competition,
                competitionId: fixture.CompetitionId,
                fixtureGroupId: fixture.FixtureGroupId,
                participant1Id: fixture.Participant1Id,
                participant1: fixture.Participant1,
                participant2Id: fixture.Participant2Id,
                participant2: fixture.Participant2,
                participant1IsHome: fixture.Participant1IsHome,
                gameState: fixture.GameState ?? null,
            };

            await prisma.$transaction(async (tx) => {
                // Ensure current fixture exists, but don't overwrite
                // a newer state with an older update.
                const current = await tx.fixture.findUnique({
                    where: {
                        fixtureId,
                    },
                    select: {
                        ts: true,
                    },
                });

                if (!current) {
                    await tx.fixture.create({
                        data: {
                            fixtureId,
                            ...data,
                        },
                    });

                    void backfillFixtureScores(fixture.FixtureId).catch((error) => {
                        logger.error(
                            "fixture.cron",
                            `Scores backfill failed for new fixture ${fixture.FixtureId}`,
                            error,
                        );
                    });
                } else if (ts > current.ts) {
                    await tx.fixture.update({
                        where: {
                            fixtureId,
                        },
                        data,
                    });
                }

                // Preserve every unique update
                await tx.fixtureUpdate.upsert({
                    where: {
                        fixtureId_ts: {
                            fixtureId,
                            ts,
                        },
                    },
                    update: {},
                    create: {
                        fixtureId,
                        ...data,
                        payload: fixture as unknown as Prisma.InputJsonValue,
                    },
                });
            });
        }

        logger.success("fixture.cron", `Processed ${fixtures.length} unique fixture updates.`);
    } catch (error) {
        logger.error("fixture.cron", "Fixture updates sync failed", error);
    } finally {
        isUpdateSyncRunning = false;
    }
}

function getPreviousHour() {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() - 1);
    
    const epochDay = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
    const hourOfDay = now.getUTCHours();
    
    return {
        epochDay,
        hourOfDay,
    };
}

export async function syncPreviousHourBatchValidation() {
    if (isBatchValidationSyncRunning) {
        logger.warn("fixture.cron", "Batch validation sync already running. Skipping.");
        return;
    }

    isBatchValidationSyncRunning = true;
    logger.info("fixture.cron", "Starting previous hour batch validation sync...");
    try {
        const fixtureService = new FixtureService();
        const { epochDay, hourOfDay } = getPreviousHour();
        
        const validation = await fixtureService.getFixtureBatchValidation(epochDay, hourOfDay);
        
        if (!validation) {
            logger.info("fixture.cron", `No batch validation returned for day ${epochDay} hour ${hourOfDay}.`);
            return;
        }
        
        await prisma.fixtureBatchValidation.upsert({
            where: {
                epochDay_hourOfDay: {
                    epochDay,
                    hourOfDay,
                },
            },
            update: {
                validation: validation as unknown as Prisma.InputJsonValue,
            },
            create: {
                epochDay,
                hourOfDay,
                validation: validation as unknown as Prisma.InputJsonValue,
            },
        });
        
        logger.success("fixture.cron", `Successfully synced batch validation for day ${epochDay} hour ${hourOfDay}.`);
    } catch (error) {
        logger.error("fixture.cron", "Batch validation sync failed", error);
    } finally {
        isBatchValidationSyncRunning = false;
    }
}

export function startFixtureCron() {
    // Full snapshot reconciliation once per hour — catches new/removed fixtures
    // that the delta-only /fixtures/updates polling (below) can't surface.
    const snapshotTask = cron.schedule("0 * * * *", () => {
        void syncFixtures();
    });

    // Sync updates every 5 minutes
    const updatesTask = cron.schedule("*/5 * * * *", () => {
        void syncFixtureUpdates();
    });

    // Sync batch validation once per completed hour (retrying at minutes 5, 20, 35, 50)
    const batchTask = cron.schedule("5,20,35,50 * * * *", () => {
        void syncPreviousHourBatchValidation();
    });
    
    return { snapshotTask, updatesTask, batchTask };
}