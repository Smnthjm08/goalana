import { Program, type AnchorProvider, type Idl } from "@coral-xyz/anchor";
import idl from "./idl/goalana_program.json";
import txoracleIdl from "./idl/txoracle.json";

import { type GoalanaProgram } from "./types/goalana_program";
import { type Txoracle } from "./types/txoracle";

/**
 * Instantiates the Anchor Program client for the Goalana on-chain program.
 *
 * @param provider The Anchor provider containing the connection and wallet.
 * @returns The instantiated Anchor Program client.
 */
export function getGoalanaProgram(provider: AnchorProvider): Program<GoalanaProgram> {
  return new Program(idl as Idl, provider) as unknown as Program<GoalanaProgram>;
}

/**
 * Instantiates the Anchor Program client for TxLINE's own `txoracle` program
 * (subscriptions/pricing) — vendored IDL, not built from this repo. Distinct
 * from `txoracle.ts`'s hand-built `validate_stat` CPI caller: this is the
 * full program surface, used only by one-off admin scripts (e.g.
 * `apps/api/src/scripts/activate.ts`) against whichever network's deployed
 * program the caller's provider points at.
 *
 * @param provider The Anchor provider containing the connection and wallet.
 * @returns The instantiated Anchor Program client.
 */
export function getTxoracleProgram(provider: AnchorProvider): Program<Txoracle> {
  return new Program(txoracleIdl as Idl, provider) as unknown as Program<Txoracle>;
}

export { idl as GoalanaIdl, txoracleIdl as TxoracleIdl };
export type { GoalanaProgram, Txoracle };


