import { Program, type AnchorProvider, type Idl } from "@coral-xyz/anchor";
import idl from "./idl/goalana_program.json";

import { type GoalanaProgram } from "./types/goalana_program";

/**
 * Instantiates the Anchor Program client for the Goalana on-chain program.
 *
 * @param provider The Anchor provider containing the connection and wallet.
 * @returns The instantiated Anchor Program client.
 */
export function getGoalanaProgram(provider: AnchorProvider): Program<GoalanaProgram> {
  return new Program(idl as Idl, provider) as unknown as Program<GoalanaProgram>;
}

export { idl as GoalanaIdl };
export type { GoalanaProgram };


