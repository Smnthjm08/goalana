/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/goalana_program.json`.
 */
export type GoalanaProgram = {
  "address": "ELiJEqT95P8LzEiTrA86TEXXoLbK61cxxHFevvPDGE42",
  "metadata": {
    "name": "goalanaProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelMarket",
      "discriminator": [
        205,
        121,
        84,
        210,
        222,
        71,
        150,
        11
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.fixtureId",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.predicateHash",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimRefund",
      "discriminator": [
        15,
        16,
        30,
        161,
        255,
        228,
        97,
        60
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.fixtureId",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.predicateHash",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimWinnings",
      "discriminator": [
        161,
        215,
        24,
        59,
        14,
        236,
        242,
        221
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.fixtureId",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.predicateHash",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "closePosition",
      "discriminator": [
        123,
        134,
        81,
        0,
        49,
        68,
        98,
        98
      ],
      "accounts": [
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "position.market",
                "account": "position"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "createChallengeMarket",
      "discriminator": [
        111,
        148,
        183,
        222,
        210,
        148,
        244,
        255
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "fixtureId"
              },
              {
                "kind": "arg",
                "path": "predicateHash"
              }
            ]
          }
        },
        {
          "name": "challengePool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  108,
                  108,
                  101,
                  110,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Global Goalana protocol configuration."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "fixtureId",
          "type": "i64"
        },
        {
          "name": "predicate",
          "type": {
            "defined": {
              "name": "predicate"
            }
          }
        },
        {
          "name": "predicateHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "locksAt",
          "type": "i64"
        },
        {
          "name": "settleAfter",
          "type": "i64"
        },
        {
          "name": "fixedStake",
          "type": "u64"
        },
        {
          "name": "slotsPerSide",
          "type": "u16"
        },
        {
          "name": "proposedBy",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "createMarket",
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "fixtureId"
              },
              {
                "kind": "arg",
                "path": "predicateHash"
              }
            ]
          }
        },
        {
          "name": "config",
          "docs": [
            "Global Goalana protocol configuration."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "fixtureId",
          "type": "i64"
        },
        {
          "name": "predicate",
          "type": {
            "defined": {
              "name": "predicate"
            }
          }
        },
        {
          "name": "predicateHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "locksAt",
          "type": "i64"
        },
        {
          "name": "settleAfter",
          "type": "i64"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "lockMarket",
      "discriminator": [
        107,
        8,
        184,
        91,
        223,
        13,
        180,
        38
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.fixtureId",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.predicateHash",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "placeBet",
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.fixtureId",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.predicateHash",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "betSide"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "placeChallengeBet",
      "discriminator": [
        229,
        236,
        70,
        234,
        215,
        47,
        179,
        121
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.fixtureId",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.predicateHash",
                "account": "market"
              }
            ]
          },
          "relations": [
            "challengePool"
          ]
        },
        {
          "name": "challengePool",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  108,
                  108,
                  101,
                  110,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "side",
          "type": {
            "defined": {
              "name": "betSide"
            }
          }
        }
      ]
    },
    {
      "name": "settleMarket",
      "discriminator": [
        193,
        153,
        95,
        216,
        166,
        6,
        144,
        217
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.fixtureId",
                "account": "market"
              },
              {
                "kind": "account",
                "path": "market.predicateHash",
                "account": "market"
              }
            ]
          }
        },
        {
          "name": "txoracleProgram",
          "address": "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
        },
        {
          "name": "dailyScoresMerkleRoots"
        }
      ],
      "args": [
        {
          "name": "oracleTsMs",
          "type": "i64"
        },
        {
          "name": "fixtureSummary",
          "type": {
            "defined": {
              "name": "scoresBatchSummary"
            }
          }
        },
        {
          "name": "fixtureProof",
          "type": {
            "vec": {
              "defined": {
                "name": "proofNode"
              }
            }
          }
        },
        {
          "name": "mainTreeProof",
          "type": {
            "vec": {
              "defined": {
                "name": "proofNode"
              }
            }
          }
        },
        {
          "name": "statA",
          "type": {
            "defined": {
              "name": "statTerm"
            }
          }
        },
        {
          "name": "statB",
          "type": {
            "option": {
              "defined": {
                "name": "statTerm"
              }
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "challengePool",
      "discriminator": [
        141,
        155,
        150,
        172,
        47,
        129,
        41,
        87
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "position",
      "discriminator": [
        170,
        188,
        143,
        228,
        122,
        64,
        247,
        208
      ]
    },
    {
      "name": "protocolConfig",
      "discriminator": [
        207,
        91,
        250,
        28,
        152,
        179,
        215,
        209
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "marketSettled",
      "discriminator": [
        237,
        212,
        22,
        175,
        201,
        117,
        215,
        99
      ]
    },
    {
      "name": "refundClaimed",
      "discriminator": [
        136,
        64,
        242,
        99,
        4,
        244,
        208,
        130
      ]
    },
    {
      "name": "winningsClaimed",
      "discriminator": [
        187,
        184,
        29,
        196,
        54,
        117,
        70,
        150
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidPredicateHash",
      "msg": "Predicate hash does not match the provided predicate."
    },
    {
      "code": 6001,
      "name": "invalidPredicateStructure",
      "msg": "Predicate structure is invalid."
    },
    {
      "code": 6002,
      "name": "unauthorizedMarketAuthority",
      "msg": "Unauthorized market authority."
    },
    {
      "code": 6003,
      "name": "marketNotOpen",
      "msg": "Market is not open."
    },
    {
      "code": 6004,
      "name": "marketNotSettled",
      "msg": "Market is not settled."
    },
    {
      "code": 6005,
      "name": "notPublicOrderbook",
      "msg": "Market is not a public orderbook."
    },
    {
      "code": 6006,
      "name": "unauthorized",
      "msg": "Unauthorized caller."
    },
    {
      "code": 6007,
      "name": "marketNotCancellable",
      "msg": "Market cannot be cancelled in its current state."
    },
    {
      "code": 6008,
      "name": "invalidLockTime",
      "msg": "Lock time must be in the future."
    },
    {
      "code": 6009,
      "name": "marketNotLocked",
      "msg": "Market is not locked."
    },
    {
      "code": 6010,
      "name": "fixtureMismatch",
      "msg": "TxLINE fixture does not match the market fixture."
    },
    {
      "code": 6011,
      "name": "statKeyMismatch",
      "msg": "Stat key does not match the market predicate."
    },
    {
      "code": 6012,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow occurred."
    },
    {
      "code": 6013,
      "name": "marketNotSettleable",
      "msg": "Market is not in a settleable state (must be Open or Locked)."
    },
    {
      "code": 6014,
      "name": "marketAlreadySettled",
      "msg": "Market outcome is already recorded."
    },
    {
      "code": 6015,
      "name": "invalidStatKey",
      "msg": "Invalid stat key — not a known TxLINE soccer stat key."
    },
    {
      "code": 6016,
      "name": "missingBinaryOp",
      "msg": "BinaryOp is required when stat_b_key is present."
    },
    {
      "code": 6017,
      "name": "unexpectedBinaryOp",
      "msg": "BinaryOp must not be set when stat_b_key is absent."
    },
    {
      "code": 6018,
      "name": "invalidSettlementTime",
      "msg": "Settlement time must be after the lock time."
    },
    {
      "code": 6019,
      "name": "missingOracleReturnData",
      "msg": "TxOracle returned no settlement result"
    },
    {
      "code": 6020,
      "name": "invalidOracleReturnProgram",
      "msg": "Settlement result was returned by an unexpected program"
    },
    {
      "code": 6021,
      "name": "invalidOracleReturnData",
      "msg": "TxOracle returned malformed settlement data"
    },
    {
      "code": 6022,
      "name": "invalidOraclePda",
      "msg": "Invalid daily Merkle roots PDA"
    },
    {
      "code": 6023,
      "name": "settlementTooEarly",
      "msg": "Settlement time has not been reached."
    },
    {
      "code": 6024,
      "name": "invalidOracleTimestamp",
      "msg": "Invalid TxOracle timestamp."
    },
    {
      "code": 6025,
      "name": "staleOracleSnapshot",
      "msg": "Oracle snapshot predates the market settlement window."
    },
    {
      "code": 6026,
      "name": "bettingLocked",
      "msg": "Betting is locked for this market."
    },
    {
      "code": 6027,
      "name": "invalidBetAmount",
      "msg": "Bet amount must be greater than zero."
    },
    {
      "code": 6028,
      "name": "alreadyClaimed",
      "msg": "Already claimed winnings or refund."
    },
    {
      "code": 6029,
      "name": "noWinningStake",
      "msg": "No winning stake on this position."
    },
    {
      "code": 6030,
      "name": "divisionByZero",
      "msg": "Division by zero occurred."
    },
    {
      "code": 6031,
      "name": "invalidRefundState",
      "msg": "Refund is not allowed (market must be cancelled or settled with no winning pool)."
    },
    {
      "code": 6032,
      "name": "marketNotCancelled",
      "msg": "Market is not cancelled."
    },
    {
      "code": 6033,
      "name": "invalidPosition",
      "msg": "Position does not belong to the expected market or user."
    },
    {
      "code": 6034,
      "name": "noRefundableStake",
      "msg": "Position has no refundable stake."
    },
    {
      "code": 6035,
      "name": "insufficientVaultBalance",
      "msg": "Insufficient vault balance to fulfill payout or refund."
    },
    {
      "code": 6036,
      "name": "positionNotClaimed",
      "msg": "Position must be claimed before it can be closed."
    },
    {
      "code": 6037,
      "name": "invalidChallengeConfig",
      "msg": "Challenge pool configuration is invalid (stake and slots must be non-zero)."
    },
    {
      "code": 6038,
      "name": "invalidChallengePool",
      "msg": "Challenge pool does not belong to the expected market."
    },
    {
      "code": 6039,
      "name": "challengePoolSideFull",
      "msg": "This side of the challenge pool is full."
    }
  ],
  "types": [
    {
      "name": "betSide",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "yes"
          },
          {
            "name": "no"
          }
        ]
      }
    },
    {
      "name": "binaryOp",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "add"
          },
          {
            "name": "subtract"
          }
        ]
      }
    },
    {
      "name": "challengePool",
      "docs": [
        "On-chain, immutable terms for a user-proposed fixed-stake N-vs-N",
        "\"challenge pool\" (final-features.md #1).",
        "",
        "A ChallengePool is a companion account to a normal Market: the Market holds",
        "the settlement predicate + pari-mutuel escrow exactly as any other market,",
        "while this account commits the pool's *economic* terms — the fixed per-entry",
        "stake and the per-side entrant cap — into consensus so they are publicly",
        "verifiable on Explorer and enforced on-chain by `place_challenge_bet`.",
        "",
        "It is deliberately additive: it does not change the Market layout, and the",
        "generic `place_bet`/`settle_market`/`claim_*` instructions are untouched.",
        "",
        "PDA:",
        "",
        "seeds = [",
        "b\"challenge\",",
        "market.key(),",
        "]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "docs": [
              "The Market whose bets this pool constrains."
            ],
            "type": "pubkey"
          },
          {
            "name": "proposedBy",
            "docs": [
              "Wallet that proposed the pool. Informational provenance only — it is NOT",
              "an authority and grants no privileges (the house signs creation)."
            ],
            "type": "pubkey"
          },
          {
            "name": "fixedStake",
            "docs": [
              "Every entrant must stake exactly this many lamports on either side."
            ],
            "type": "u64"
          },
          {
            "name": "slotsPerSide",
            "docs": [
              "Maximum entrants per side. The total stake allowed on a single side is",
              "`fixed_stake * slots_per_side`."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "comparison",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "greaterThan"
          },
          {
            "name": "lessThan"
          },
          {
            "name": "equalTo"
          }
        ]
      }
    },
    {
      "name": "market",
      "docs": [
        "Canonical prediction market.",
        "",
        "Exactly one Market exists for each:",
        "",
        "(fixture_id, predicate)",
        "",
        "The Market is shared by all trading mechanisms:",
        "",
        "Market",
        "├── Orderbook",
        "├── Challenge(s)",
        "└── Pool",
        "",
        "A Market may originally be created by:",
        "",
        "- House: Goalana's configured market authority",
        "- User: Any permissionless user",
        "",
        "The origin does not affect settlement.",
        "",
        "PDA:",
        "",
        "seeds = [",
        "b\"market\",",
        "fixture_id.to_le_bytes(),",
        "predicate_hash,",
        "]",
        "",
        "where:",
        "",
        "predicate_hash = sha256(borsh(predicate))"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "createdBy",
            "docs": [
              "Wallet that originally created the canonical Market.",
              "",
              "This does NOT make the wallet the owner of the Market."
            ],
            "type": "pubkey"
          },
          {
            "name": "origin",
            "docs": [
              "Whether the Market was originally created by the",
              "Goalana House or by a permissionless user."
            ],
            "type": {
              "defined": {
                "name": "marketOrigin"
              }
            }
          },
          {
            "name": "fixtureId",
            "docs": [
              "TxLINE fixture identifier."
            ],
            "type": "i64"
          },
          {
            "name": "predicateHash",
            "docs": [
              "SHA256 hash of the Borsh-serialized Predicate."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "predicate",
            "docs": [
              "Settlement condition for this Market."
            ],
            "type": {
              "defined": {
                "name": "predicate"
              }
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "marketStatus"
              }
            }
          },
          {
            "name": "outcome",
            "docs": [
              "Final result of the Predicate.",
              "",
              "None        -> not settled",
              "Some(true)  -> predicate resolved true",
              "Some(false) -> predicate resolved false"
            ],
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when the Market was created."
            ],
            "type": "i64"
          },
          {
            "name": "locksAt",
            "docs": [
              "Deterministic Unix timestamp when the Market automatically locks (e.g. event kickoff)."
            ],
            "type": "i64"
          },
          {
            "name": "settleAfter",
            "docs": [
              "Deterministic Unix timestamp after which settlement is allowed (e.g. match finished)."
            ],
            "type": "i64"
          },
          {
            "name": "lockedAt",
            "docs": [
              "Unix timestamp when the Market was locked manually or automatically."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "settledAt",
            "docs": [
              "Unix timestamp when the Market was settled."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "cancelledAt",
            "docs": [
              "Unix timestamp when the Market was cancelled."
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "totalYes",
            "type": "u64"
          },
          {
            "name": "totalNo",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketOrigin",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "house"
          },
          {
            "name": "user"
          }
        ]
      }
    },
    {
      "name": "marketSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "outcome",
            "type": "bool"
          },
          {
            "name": "oracleTsMs",
            "type": "i64"
          },
          {
            "name": "settledAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "marketStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "locked"
          },
          {
            "name": "settled"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "docs": [
              "The market this position belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "user",
            "docs": [
              "The user who owns this position."
            ],
            "type": "pubkey"
          },
          {
            "name": "yesAmount",
            "docs": [
              "Total amount bet on YES (in lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "noAmount",
            "docs": [
              "Total amount bet on NO (in lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "claimed",
            "docs": [
              "Whether the user has claimed winnings or a refund for this position."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "predicate",
      "docs": [
        "Generic predicate describing how this market should be settled.",
        "",
        "The frontend builds this from the Question Builder.",
        "",
        "Market PDA:",
        "",
        "seeds = [",
        "b\"market\",",
        "fixture_id.to_le_bytes(),",
        "sha256(borsh(predicate)),",
        "]",
        "",
        "The SDK computes the predicate hash and the program verifies it",
        "on-chain before creating the Market."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "statAKey",
            "docs": [
              "Primary TxLINE stat key."
            ],
            "type": "u32"
          },
          {
            "name": "statBKey",
            "docs": [
              "Optional second TxLINE stat key."
            ],
            "type": {
              "option": "u32"
            }
          },
          {
            "name": "op",
            "docs": [
              "Optional arithmetic operation between stat A and stat B."
            ],
            "type": {
              "option": {
                "defined": {
                  "name": "binaryOp"
                }
              }
            }
          },
          {
            "name": "threshold",
            "docs": [
              "Value against which the resolved stat is compared."
            ],
            "type": "i32"
          },
          {
            "name": "comparison",
            "docs": [
              "Comparison operator."
            ],
            "type": {
              "defined": {
                "name": "comparison"
              }
            }
          }
        ]
      }
    },
    {
      "name": "proofNode",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isRightSibling",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "protocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Protocol administrator."
            ],
            "type": "pubkey"
          },
          {
            "name": "marketAuthority",
            "docs": [
              "Authority permitted to create official House markets."
            ],
            "type": "pubkey"
          },
          {
            "name": "settlementAuthority",
            "docs": [
              "Reserved authority for emergency or trusted fallback settlement.",
              "",
              "Normal TxLINE proof-based settlement is permissionless and",
              "does not require this authority to sign."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "refundClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "scoreStat",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": "u32"
          },
          {
            "name": "value",
            "type": "i32"
          },
          {
            "name": "period",
            "type": "i32"
          }
        ]
      }
    },
    {
      "name": "scoresBatchSummary",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fixtureId",
            "type": "i64"
          },
          {
            "name": "updateStats",
            "type": {
              "defined": {
                "name": "scoresUpdateStats"
              }
            }
          },
          {
            "name": "eventsSubTreeRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "scoresUpdateStats",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "updateCount",
            "type": "i32"
          },
          {
            "name": "minTimestamp",
            "type": "i64"
          },
          {
            "name": "maxTimestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "statTerm",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "statToProve",
            "type": {
              "defined": {
                "name": "scoreStat"
              }
            }
          },
          {
            "name": "eventStatRoot",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "statProof",
            "type": {
              "vec": {
                "defined": {
                  "name": "proofNode"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "winningsClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "winningStake",
            "type": "u64"
          },
          {
            "name": "payout",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
