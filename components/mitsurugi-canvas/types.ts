export type Zone =
  | "hand"
  | "deck"
  | "field"
  | "graveyard"
  | "banished"
  | "extraDeck"
  | "any";

export type CardKind = "monster" | "spell" | "trap" | "extra";

export type ActionType =
  | "search"
  | "specialSummon"
  | "ritualSummon"
  | "tribute"
  | "revive"
  | "recover"
  | "destroy"
  | "negate"
  | "linkSummon"
  | "xyzSummon"
  | "enable";

export type TargetFilter = {
  cardId?: string;
  archetype?: string;
  kind?: CardKind;
  race?: string;
  level?: number;
  from?: Zone;
  to?: Zone;
  text?: string;
};

export type Condition =
  | {
      type: "single";
      label: string;
    }
  | {
      type: "and";
      label: string;
      conditions: Condition[];
    };

export type CardAction = {
  id: string;
  label: string;
  type: ActionType;
  from?: Zone;
  to?: Zone;
  target: TargetFilter;
  condition?: Condition;
  note?: string;
};

export type CardData = {
  id: string;
  name: string;
  apiName?: string;
  apiId?: number;
  archetype?: string;
  kind: CardKind;
  race?: string;
  level?: number;
  cardType?: string;
  tags?: string[];
  summary: string;
  actions: CardAction[];
};

export type OpponentAction = "none" | "specialSummon" | "activatedEffect";

export type GameState = {
  hand: string[];
  field: string[];
  graveyard: string[];
  banished: string[];
  deck: string[];
  extraDeck: string[];
  opponentAction: OpponentAction;
  ritualSummoned: string[];
};

export type PlaygroundScenarioStep = {
  sourceCardId: string;
  actionId: string;
  targetCardId?: string;
  label?: string;
};

export type PlaygroundScenario = {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  initialHand: string[];
  gameState?: Partial<GameState>;
  steps?: PlaygroundScenarioStep[];
};
