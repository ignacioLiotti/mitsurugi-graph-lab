import starterHabakiri from "./playgrounds/starter-habakiri.json";
import {
  CardData,
  GameState,
  OpponentAction,
  PlaygroundScenario,
  PlaygroundScenarioStep,
} from "./types";
import { createInitialPlaygroundState, PlaygroundStep } from "./playgroundEngine";

const validOpponentActions: OpponentAction[] = ["none", "specialSummon", "activatedEffect"];

export const builtInPlaygrounds = [starterHabakiri as PlaygroundScenario];

type ScenarioParseResult =
  | { ok: true; scenario: PlaygroundScenario }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function parsePlaygroundScenario(value: unknown): ScenarioParseResult {
  if (!isObject(value)) return { ok: false, error: "El JSON debe ser un objeto." };
  if (value.schemaVersion !== 1) return { ok: false, error: "schemaVersion debe ser 1." };
  if (typeof value.id !== "string" || !value.id.trim()) return { ok: false, error: "Falta id." };
  if (typeof value.name !== "string" || !value.name.trim()) return { ok: false, error: "Falta name." };

  const initialHand = stringArray(value.initialHand);
  if (!initialHand.length) return { ok: false, error: "initialHand debe tener al menos una carta." };

  const gameState = isObject(value.gameState) ? value.gameState : undefined;
  const steps = Array.isArray(value.steps)
    ? value.steps
        .filter(isObject)
        .map((step) => ({
          sourceCardId: typeof step.sourceCardId === "string" ? step.sourceCardId : "",
          actionId: typeof step.actionId === "string" ? step.actionId : "",
          targetCardId: typeof step.targetCardId === "string" ? step.targetCardId : undefined,
          label: typeof step.label === "string" ? step.label : undefined,
        }))
        .filter((step) => step.sourceCardId && step.actionId)
    : [];

  return {
    ok: true,
    scenario: {
      schemaVersion: 1,
      id: value.id,
      name: value.name,
      description: typeof value.description === "string" ? value.description : undefined,
      tags: stringArray(value.tags),
      initialHand,
      gameState: gameState
        ? {
            hand: stringArray(gameState.hand),
            field: stringArray(gameState.field),
            graveyard: stringArray(gameState.graveyard),
            banished: stringArray(gameState.banished),
            deck: stringArray(gameState.deck),
            extraDeck: stringArray(gameState.extraDeck),
            opponentAction: validOpponentActions.includes(gameState.opponentAction as OpponentAction)
              ? (gameState.opponentAction as OpponentAction)
              : "none",
            ritualSummoned: stringArray(gameState.ritualSummoned),
          }
        : undefined,
      steps,
    },
  };
}

function knownCardIds(cards: CardData[]) {
  return new Set(cards.map((card) => card.id));
}

function filterCards(ids: string[] | undefined, knownIds: Set<string>) {
  return (ids ?? []).filter((id) => knownIds.has(id));
}

export function scenarioToGameState(cards: CardData[], scenario: PlaygroundScenario): GameState {
  const knownIds = knownCardIds(cards);
  const initialState = createInitialPlaygroundState(cards, filterCards(scenario.initialHand, knownIds));
  const state = scenario.gameState;

  if (!state) return initialState;

  return {
    hand: filterCards(state.hand, knownIds),
    field: filterCards(state.field, knownIds),
    graveyard: filterCards(state.graveyard, knownIds),
    banished: filterCards(state.banished, knownIds),
    deck: filterCards(state.deck, knownIds),
    extraDeck: filterCards(state.extraDeck, knownIds),
    opponentAction: state.opponentAction ?? "none",
    ritualSummoned: filterCards(state.ritualSummoned, knownIds),
  };
}

function stepLabel(cards: CardData[], step: PlaygroundScenarioStep) {
  if (step.label) return step.label;

  const source = cards.find((card) => card.id === step.sourceCardId);
  const action = source?.actions.find((item) => item.id === step.actionId);
  const target = step.targetCardId ? cards.find((card) => card.id === step.targetCardId) : undefined;

  if (!action) return step.actionId;
  return target ? `${action.label} -> ${target.name}` : action.label;
}

export function scenarioToSteps(cards: CardData[], scenario: PlaygroundScenario): PlaygroundStep[] {
  const knownIds = knownCardIds(cards);

  return (scenario.steps ?? [])
    .filter((step) => {
      const source = cards.find((card) => card.id === step.sourceCardId);
      const actionExists = source?.actions.some((action) => action.id === step.actionId);
      const targetExists = !step.targetCardId || knownIds.has(step.targetCardId);
      return Boolean(source && actionExists && targetExists);
    })
    .map((step, index) => ({
      id: `${index + 1}-${step.sourceCardId}-${step.actionId}`,
      sourceCardId: step.sourceCardId,
      actionId: step.actionId,
      targetCardId: step.targetCardId,
      label: stepLabel(cards, step),
    }));
}

export function scenarioInitialHand(cards: CardData[], scenario: PlaygroundScenario) {
  return filterCards(scenario.initialHand, knownCardIds(cards));
}

export function currentPlaygroundToScenario(
  id: string,
  name: string,
  initialHand: string[],
  gameState: GameState,
  steps: PlaygroundStep[],
): PlaygroundScenario {
  return {
    schemaVersion: 1,
    id,
    name,
    description: "Exported from Mitsurugi Graph Lab.",
    tags: ["exported"],
    initialHand,
    gameState,
    steps: steps.map((step) => ({
      sourceCardId: step.sourceCardId,
      actionId: step.actionId,
      targetCardId: step.targetCardId,
      label: step.label,
    })),
  };
}
