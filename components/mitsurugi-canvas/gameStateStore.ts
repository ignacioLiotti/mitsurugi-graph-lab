import { create } from "zustand";
import { cards } from "./cards";
import { GameState, OpponentAction, Zone } from "./types";

export const editableZones: Zone[] = [
  "hand",
  "field",
  "graveyard",
  "banished",
  "deck",
  "extraDeck",
];

const defaultState: GameState = {
  hand: ["habakiri", "prayers"],
  field: [],
  graveyard: [],
  banished: [],
  deck: [
    "saji",
    "aramasa",
    "kusanagi",
    "murakumo",
    "futsu",
    "ritual",
    "mirror",
    "magatama",
    "purification",
    "night-sword-serpent",
  ],
  extraDeck: ["dyna-mondo", "ip", "sp"],
  opponentAction: "none",
  ritualSummoned: [],
};

type GameStateStore = {
  gameState: GameState;
  toggleCardInZone: (zone: Zone, cardId: string) => void;
  setOpponentAction: (action: OpponentAction) => void;
  toggleRitualSummoned: (cardId: string) => void;
  reset: () => void;
};

function removeFromAllZones(state: GameState, cardId: string): GameState {
  return {
    ...state,
    hand: state.hand.filter((id) => id !== cardId),
    field: state.field.filter((id) => id !== cardId),
    graveyard: state.graveyard.filter((id) => id !== cardId),
    banished: state.banished.filter((id) => id !== cardId),
    deck: state.deck.filter((id) => id !== cardId),
    extraDeck: state.extraDeck.filter((id) => id !== cardId),
  };
}

export const useGameStateStore = create<GameStateStore>((set) => ({
  gameState: defaultState,
  toggleCardInZone: (zone, cardId) => {
    if (zone === "any") return;

    set(({ gameState }) => {
      const alreadyInZone = gameState[zone].includes(cardId);
      const cleared = removeFromAllZones(gameState, cardId);

      if (alreadyInZone) {
        return { gameState: cleared };
      }

      return {
        gameState: {
          ...cleared,
          [zone]: [...cleared[zone], cardId],
        },
      };
    });
  },
  setOpponentAction: (opponentAction) => {
    set(({ gameState }) => ({ gameState: { ...gameState, opponentAction } }));
  },
  toggleRitualSummoned: (cardId) => {
    set(({ gameState }) => {
      const ritualSummoned = gameState.ritualSummoned.includes(cardId)
        ? gameState.ritualSummoned.filter((id) => id !== cardId)
        : [...gameState.ritualSummoned, cardId];

      return { gameState: { ...gameState, ritualSummoned } };
    });
  },
  reset: () => {
    set({ gameState: defaultState });
  },
}));

export function cardName(cardId: string) {
  return cards.find((card) => card.id === cardId)?.name ?? cardId;
}
