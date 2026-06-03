import { Edge, MarkerType, Node } from "@xyflow/react";
import { getCardImageUrl } from "./cardApi";
import { CardAction, CardData, GameState, TargetFilter, Zone } from "./types";

type ConcreteZone = Exclude<Zone, "any">;

export type PlaygroundStep = {
  id: string;
  sourceCardId: string;
  actionId: string;
  targetCardId?: string;
  label: string;
  effectNumber?: number;
  effectName?: string;
  description?: string;
  materials?: string[];
};

export type PlaygroundSnapshot = {
  id: string;
  label: string;
  description?: string;
  effectName?: string;
  effectNumber?: number;
  materials?: string[];
  state: GameState;
  sourceCardId?: string;
  targetCardId?: string;
};

export function createInitialPlaygroundState(cards: CardData[], hand: string[]): GameState {
  const handSet = new Set(hand);

  return {
    hand,
    field: [],
    graveyard: [],
    banished: [],
    deck: cards.filter((card) => card.kind !== "extra" && !handSet.has(card.id)).map((card) => card.id),
    extraDeck: cards.filter((card) => card.kind === "extra").map((card) => card.id),
    opponentAction: "none",
    ritualSummoned: [],
  };
}

export function matchesTarget(card: CardData, target: TargetFilter): boolean {
  if (target.cardId && card.id !== target.cardId) return false;
  if (target.archetype && card.archetype !== target.archetype) return false;
  if (target.kind && card.kind !== target.kind) return false;
  if (target.race && card.race !== target.race) return false;
  if (target.level && card.level !== target.level) return false;
  return true;
}

export function actionTargets(cards: CardData[], gameState: GameState, action: CardAction) {
  const zones: ConcreteZone[] =
    !action.target.from || action.target.from === "any"
      ? ["hand", "field", "graveyard", "banished", "deck", "extraDeck"]
      : [action.target.from as ConcreteZone];

  return cards.filter((card) => {
    if (!matchesTarget(card, action.target)) return false;
    return zones.some((zone) => gameState[zone].includes(card.id));
  });
}

function removeCardFromZones(gameState: GameState, cardId: string): GameState {
  return {
    ...gameState,
    hand: gameState.hand.filter((id) => id !== cardId),
    field: gameState.field.filter((id) => id !== cardId),
    graveyard: gameState.graveyard.filter((id) => id !== cardId),
    banished: gameState.banished.filter((id) => id !== cardId),
    deck: gameState.deck.filter((id) => id !== cardId),
    extraDeck: gameState.extraDeck.filter((id) => id !== cardId),
  };
}

function addToZone(gameState: GameState, zone: Zone | undefined, cardId: string): GameState {
  if (!zone || zone === "any") return gameState;
  if (gameState[zone].includes(cardId)) return gameState;

  return {
    ...gameState,
    [zone]: [...gameState[zone], cardId],
  };
}

export function applyPlaygroundAction(
  gameState: GameState,
  sourceCard: CardData,
  action: CardAction,
  targetCardId?: string,
  materials: string[] = [],
) {
  let nextState = gameState;

  for (const material of materials) {
    nextState = removeCardFromZones(nextState, material);
    if (action.type !== "xyzSummon") {
      nextState = addToZone(nextState, "graveyard", material);
    }
  }

  if (targetCardId && action.target.to && action.target.to !== "any") {
    nextState = removeCardFromZones(nextState, targetCardId);
    nextState = addToZone(nextState, action.target.to, targetCardId);
  }

  if (action.id === "prayers-both" && targetCardId) {
    nextState = removeCardFromZones(nextState, targetCardId);
    nextState = addToZone(nextState, "graveyard", targetCardId);
  }

  if (action.type === "tribute") {
    const tributeTarget = targetCardId ?? nextState.field[0] ?? sourceCard.id;
    nextState = removeCardFromZones(nextState, tributeTarget);
    nextState = addToZone(nextState, "graveyard", tributeTarget);
  }

  if (["normalSummon", "ritualSummon", "specialSummon", "revive", "linkSummon", "xyzSummon", "setCard"].includes(action.type) && targetCardId) {
    nextState = removeCardFromZones(nextState, targetCardId);
    nextState = addToZone(nextState, "field", targetCardId);
  }

  return nextState;
}

function cardNode(card: CardData, x: number, y: number, available = true): Node {
  return {
    id: `play-card-${card.id}-${x}-${y}`,
    type: "card",
    position: { x, y },
    data: {
      title: card.name,
      subtitle: card.cardType,
      summary: card.summary,
      tags: card.tags ?? [],
      cardId: card.id,
      imageUrl: getCardImageUrl(card),
      nodeKind: "card",
      available,
    },
  };
}

export function buildPlaygroundGraph(cards: CardData[], initialHand: string[], steps: PlaygroundStep[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const cardById = new Map(cards.map((card) => [card.id, card]));

  initialHand.forEach((cardId, index) => {
    const card = cardById.get(cardId);
    if (!card) return;
    nodes.push(cardNode(card, 0, index * 260));
  });

  steps.forEach((step, index) => {
    const sourceCard = cardById.get(step.sourceCardId);
    const targetCard = step.targetCardId ? cardById.get(step.targetCardId) : undefined;
    const actionNodeId = `play-step-${step.id}`;
    const sourceNodeId = index === 0 ? `play-card-${step.sourceCardId}-0-${initialHand.indexOf(step.sourceCardId) * 260}` : `play-result-${index - 1}`;
    const x = 420 + index * 440;

    nodes.push({
      id: actionNodeId,
      type: "action",
      position: { x, y: 140 },
      data: {
        title: step.label,
        subtitle: "Decision",
        summary: step.description ?? (sourceCard ? `Desde ${sourceCard.name}` : ""),
        imageUrl: sourceCard ? getCardImageUrl(sourceCard) : undefined,
        imageUrls: targetCard ? [getCardImageUrl(targetCard)].filter(Boolean) : [],
        nodeKind: "action",
        available: true,
      },
    });

    edges.push({
      id: `${sourceNodeId}-${actionNodeId}`,
      source: nodes.some((node) => node.id === sourceNodeId) ? sourceNodeId : actionNodeId,
      target: actionNodeId,
      label: "choose",
      animated: true,
      style: { stroke: "#16a34a" },
    });

    if (targetCard) {
      const resultNodeId = `play-result-${index}`;
      nodes.push({
        ...cardNode(targetCard, x + 420, 80),
        id: resultNodeId,
      });

      edges.push({
        id: `${actionNodeId}-${resultNodeId}`,
        source: actionNodeId,
        target: resultNodeId,
        label: "target",
        animated: true,
        style: { stroke: "#2563eb" },
      });
    }
  });

  if (!steps.length) {
    nodes.push({
      id: "play-start",
      type: "wildcard",
      position: { x: 420, y: 120 },
      data: {
        title: "Elegí una acción legal",
        subtitle: "Playground",
        summary: "Seleccioná cartas iniciales y tomá decisiones desde el panel derecho para construir la línea.",
        nodeKind: "wildcard",
        available: true,
      },
    });
  }

  return { nodes, edges };
}

function compactCard(card: CardData) {
  return {
    id: card.id,
    name: card.name,
    shortName: card.name.replace("Ame no ", "").replace(" no Mitsurugi", ""),
    imageUrl: getCardImageUrl(card),
  };
}

function snapshotCards(cardsById: Map<string, CardData>, cardIds: string[], limit?: number) {
  return cardIds
    .slice(0, limit)
    .map((cardId) => {
      const card = cardsById.get(cardId);
      return card ? compactCard(card) : null;
    })
    .filter(Boolean);
}

function cardZone(state: GameState, cardId: string): ConcreteZone | null {
  const zones: ConcreteZone[] = ["hand", "field", "graveyard", "banished", "deck", "extraDeck"];
  return zones.find((zone) => state[zone].includes(cardId)) ?? null;
}

function snapshotHighlights(previous: PlaygroundSnapshot | undefined, current: PlaygroundSnapshot) {
  const highlightedCardIds = new Set<string>();
  const highlightedZones = new Set<ConcreteZone>();

  if (current.sourceCardId) highlightedCardIds.add(current.sourceCardId);
  if (current.targetCardId) highlightedCardIds.add(current.targetCardId);

  if (previous) {
    const allCardIds = new Set([
      ...previous.state.hand,
      ...previous.state.field,
      ...previous.state.graveyard,
      ...previous.state.banished,
      ...previous.state.deck,
      ...previous.state.extraDeck,
      ...current.state.hand,
      ...current.state.field,
      ...current.state.graveyard,
      ...current.state.banished,
      ...current.state.deck,
      ...current.state.extraDeck,
    ]);

    allCardIds.forEach((cardId) => {
      const from = cardZone(previous.state, cardId);
      const to = cardZone(current.state, cardId);

      if (from !== to) {
        highlightedCardIds.add(cardId);
        if (from) highlightedZones.add(from);
        if (to) highlightedZones.add(to);
      }
    });
  }

  return {
    highlightedCardIds: Array.from(highlightedCardIds),
    highlightedZones: Array.from(highlightedZones),
  };
}

export function buildPlaygroundTimelineGraph(
  cards: CardData[],
  snapshots: PlaygroundSnapshot[],
  activeSnapshotIndex: number,
  onSelectCard: (cardId: string) => void,
  onInspectZone: (zone: ConcreteZone) => void,
) {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  snapshots.forEach((snapshot, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const highlights = snapshotHighlights(snapshots[index - 1], snapshot);

    nodes.push({
      id: `timeline-${snapshot.id}`,
      type: "snapshot",
      position: {
        x: 220 + column * 740,
        y: 220 + row * 580 + (column % 2 === 0 ? 0 : 72),
      },
      data: {
        title: `T${index}`,
        subtitle: snapshot.label,
        description: snapshot.description,
        effectName: snapshot.effectName,
        effectNumber: snapshot.effectNumber,
        materials: snapshot.materials,
        snapshotIndex: index,
        active: index === activeSnapshotIndex,
        deckCount: snapshot.state.deck.length,
        extraDeckCount: snapshot.state.extraDeck.length,
        zones: {
          hand: snapshotCards(cardsById, snapshot.state.hand, 7),
          field: snapshotCards(cardsById, snapshot.state.field, 10),
          graveyard: snapshotCards(cardsById, snapshot.state.graveyard, 6),
          banished: snapshotCards(cardsById, snapshot.state.banished, 6),
          deck: snapshotCards(cardsById, snapshot.state.deck, 12),
          extraDeck: snapshotCards(cardsById, snapshot.state.extraDeck, 12),
        },
        highlightedCardIds: highlights.highlightedCardIds,
        highlightedZones: highlights.highlightedZones,
        onSelectCard,
        onInspectZone,
      },
    });

    if (index > 0) {
      edges.push({
        id: `timeline-${snapshots[index - 1].id}-${snapshot.id}`,
        source: `timeline-${snapshots[index - 1].id}`,
        target: `timeline-${snapshot.id}`,
        type: "snapshotRelation",
        data: {
          label: snapshot.label,
        },
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#8b5cf6",
        },
        style: {
          stroke: "#8b5cf6",
          strokeWidth: 5,
        },
        labelStyle: {
          fill: "#581c87",
          fontWeight: 800,
        },
      });
    }
  });

  return { nodes, edges };
}
