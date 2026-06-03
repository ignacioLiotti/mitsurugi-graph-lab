import { Edge, Node } from "@xyflow/react";
import { getCardImageUrl } from "./cardApi";
import { CardAction, CardData, GameState, TargetFilter, Zone } from "./types";

export type GraphMode = "direct" | "expanded";
type ConcreteZone = Exclude<Zone, "any">;

const actionColors: Record<string, string> = {
  search: "#2563eb",
  specialSummon: "#16a34a",
  ritualSummon: "#9333ea",
  tribute: "#dc2626",
  revive: "#059669",
  recover: "#0891b2",
  destroy: "#ea580c",
  negate: "#7c2d12",
  linkSummon: "#4f46e5",
  xyzSummon: "#be185d",
  enable: "#64748b",
};

function cardNodeData(card: CardData, gameState: GameState) {
  return {
    title: card.name,
    subtitle: card.cardType,
    summary: card.summary,
    tags: card.tags ?? [],
    imageUrl: getCardImageUrl(card),
    nodeKind: "card",
    available: zoneContains(gameState, undefined, card.id),
  };
}

function matchesTarget(card: CardData, target: TargetFilter): boolean {
  if (target.cardId && card.id !== target.cardId) return false;
  if (target.archetype && card.archetype !== target.archetype) return false;
  if (target.kind && card.kind !== target.kind) return false;
  if (target.race && card.race !== target.race) return false;
  if (target.level && card.level !== target.level) return false;
  return true;
}

function actionTargetLabel(action: CardAction): string {
  if (action.target.cardId) return action.target.cardId;
  if (action.target.text) return action.target.text;

  const parts = [
    action.target.archetype,
    action.target.kind,
    action.target.race,
    action.target.level ? `Level ${action.target.level}` : undefined,
  ].filter(Boolean);

  return parts.length ? parts.join(" ") : "Wildcard target";
}

function conditionLabel(action: CardAction): string | null {
  if (!action.condition) return null;
  return action.condition.label;
}

function zoneContains(gameState: GameState, zone: Zone | undefined, cardId: string): boolean {
  if (!zone || zone === "any") {
    return (
      gameState.hand.includes(cardId) ||
      gameState.field.includes(cardId) ||
      gameState.graveyard.includes(cardId) ||
      gameState.banished.includes(cardId) ||
      gameState.deck.includes(cardId) ||
      gameState.extraDeck.includes(cardId)
    );
  }

  return gameState[zone].includes(cardId);
}

function targetExists(cards: CardData[], gameState: GameState, target: TargetFilter): boolean {
  const zones: ConcreteZone[] =
    !target.from || target.from === "any"
      ? ["hand", "field", "graveyard", "banished", "deck", "extraDeck"]
      : [target.from as ConcreteZone];

  return cards.some((card) => {
    if (!matchesTarget(card, target)) return false;
    return zones.some((zone) => gameState[zone].includes(card.id));
  });
}

function hasReptileForTribute(cards: CardData[], gameState: GameState, minimumLevel = 1) {
  return [...gameState.hand, ...gameState.field].some((cardId) => {
    const card = cards.find((item) => item.id === cardId);
    return card?.race === "Reptile" && (card.level ?? 0) >= minimumLevel;
  });
}

function conditionMet(cards: CardData[], gameState: GameState, card: CardData, action: CardAction): boolean {
  const label = action.condition?.label.toLowerCase() ?? "";

  if (!label) return true;
  if (label.includes("opponent special summons")) {
    return gameState.opponentAction === "specialSummon";
  }
  if (label.includes("opponent card/effect") || label.includes("activated effect")) {
    return gameState.opponentAction === "activatedEffect";
  }
  if (label.includes("properly ritual summoned")) {
    return gameState.ritualSummoned.includes(card.id);
  }
  if (label.includes("tribute 1 level 5")) {
    return hasReptileForTribute(cards, gameState, 5);
  }
  if (label.includes("tribute 1 reptile")) {
    return hasReptileForTribute(cards, gameState);
  }
  if (label.includes("dyna mondo")) {
    return gameState.field.includes("dyna-mondo") && gameState.graveyard.some((cardId) => {
      const graveCard = cards.find((item) => item.id === cardId);
      return graveCard?.cardType?.includes("Ritual");
    });
  }

  return false;
}

export function isActionAvailable(cards: CardData[], gameState: GameState, card: CardData, action: CardAction) {
  const sourceAvailable = zoneContains(gameState, "hand", card.id) || zoneContains(gameState, "field", card.id);
  const graveyardEffectAvailable = action.from === "graveyard" && zoneContains(gameState, "graveyard", card.id);
  const triggerAvailable = action.label.toLowerCase().includes("tributed");
  const targetAvailable = action.target.text?.includes("opponent") ? true : targetExists(cards, gameState, action.target);

  return (sourceAvailable || graveyardEffectAvailable || triggerAvailable) && targetAvailable && conditionMet(cards, gameState, card, action);
}

export function buildGraph(
  cards: CardData[],
  selectedCardId: string | null,
  mode: GraphMode,
  includeConditions: boolean,
  gameState: GameState,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const included = new Set<string>();
  const sourceCards = selectedCardId ? cards.filter((card) => card.id === selectedCardId) : cards;

  for (const card of sourceCards) {
    included.add(card.id);

    nodes.push({
      id: card.id,
      type: "card",
      position: { x: 0, y: 0 },
      data: cardNodeData(card, gameState),
    });

    for (const action of card.actions) {
      const actionId = `${card.id}-${action.id}`;
      const available = isActionAvailable(cards, gameState, card, action);
      const targetCards = cards.filter((targetCard) => matchesTarget(targetCard, action.target));
      const targetImageUrls = targetCards
        .slice(0, 4)
        .map((targetCard) => getCardImageUrl(targetCard))
        .filter(Boolean);

      nodes.push({
        id: actionId,
        type: "action",
        position: { x: 0, y: 0 },
        data: {
          title: action.label,
          subtitle: action.type,
          summary: action.note ?? "",
          color: actionColors[action.type] ?? "#64748b",
          imageUrl: getCardImageUrl(card),
          imageUrls: targetImageUrls,
          nodeKind: "action",
          available,
        },
      });

      edges.push({
        id: `${card.id}-${actionId}`,
        source: card.id,
        target: actionId,
        label: action.type,
        animated: available && ["specialSummon", "ritualSummon", "revive"].includes(action.type),
        style: {
          stroke: available ? actionColors[action.type] ?? "#64748b" : "#94a3b8",
          opacity: available ? 1 : 0.35,
        },
      });

      if (includeConditions) {
        const cond = conditionLabel(action);

        if (cond) {
          const conditionId = `${actionId}-condition`;

          nodes.push({
            id: conditionId,
            type: "condition",
            position: { x: 0, y: 0 },
            data: {
              title: cond,
              subtitle: "Condition",
              summary: "",
              nodeKind: "condition",
              available,
            },
          });

          edges.push({
            id: `${conditionId}-${actionId}`,
            source: conditionId,
            target: actionId,
            label: "requires",
            style: {
              stroke: available ? "#f59e0b" : "#94a3b8",
              strokeDasharray: "6 6",
              opacity: available ? 1 : 0.35,
            },
          });
        }
      }

      if (mode === "expanded") {
        const targets = cards.filter((targetCard) => matchesTarget(targetCard, action.target));

        if (targets.length > 0) {
          for (const targetCard of targets) {
            if (!included.has(targetCard.id)) {
              included.add(targetCard.id);
              nodes.push({
                id: targetCard.id,
                type: "card",
                position: { x: 0, y: 0 },
                data: cardNodeData(targetCard, gameState),
              });
            }

            edges.push({
              id: `${actionId}-${targetCard.id}`,
              source: actionId,
              target: targetCard.id,
              label: actionTargetLabel(action),
              style: {
                stroke: available ? actionColors[action.type] ?? "#64748b" : "#94a3b8",
                opacity: available ? 1 : 0.35,
              },
            });
          }
        } else {
          const wildcardId = `${actionId}-wildcard`;

          nodes.push({
            id: wildcardId,
            type: "wildcard",
            position: { x: 0, y: 0 },
            data: {
              title: actionTargetLabel(action),
              subtitle: "Wildcard",
              summary: "No necesariamente es una carta hardcodeada. Puede ser cualquier carta que cumpla la condición.",
              imageUrls: targetImageUrls,
              nodeKind: "wildcard",
              available,
            },
          });

          edges.push({
            id: `${actionId}-${wildcardId}`,
            source: actionId,
            target: wildcardId,
            label: "can access",
            style: {
              stroke: available ? "#64748b" : "#94a3b8",
              strokeDasharray: "4 4",
              opacity: available ? 1 : 0.35,
            },
          });
        }
      } else {
        const wildcardId = `${actionId}-target`;

        nodes.push({
          id: wildcardId,
          type: "wildcard",
          position: { x: 0, y: 0 },
          data: {
            title: actionTargetLabel(action),
            subtitle: "Target",
            summary: "",
            imageUrls: targetImageUrls,
            nodeKind: "wildcard",
            available,
          },
        });

        edges.push({
          id: `${actionId}-${wildcardId}`,
          source: actionId,
          target: wildcardId,
          label: "target",
          style: {
            opacity: available ? 1 : 0.35,
          },
        });
      }
    }
  }

  return autoLayout(nodes, edges);
}

function autoLayout(nodes: Node[], edges: Edge[]) {
  const incomingCount = new Map<string, number>();
  const outgoingBySource = new Map<string, Edge[]>();

  for (const node of nodes) {
    incomingCount.set(node.id, 0);
  }

  for (const edge of edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
    const outgoing = outgoingBySource.get(edge.source) ?? [];
    outgoing.push(edge);
    outgoingBySource.set(edge.source, outgoing);
  }

  const levels = new Map<string, number>();
  const queue = nodes
    .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
    .map((node) => node.id);

  for (const nodeId of queue.length ? queue : nodes.map((node) => node.id)) {
    levels.set(nodeId, 0);
  }

  if (!queue.length) {
    queue.push(...nodes.map((node) => node.id));
  }

  const visitCount = new Map<string, number>();
  const maxVisitsPerNode = 2;

  while (queue.length) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) ?? 0;
    const visits = (visitCount.get(current) ?? 0) + 1;

    visitCount.set(current, visits);

    if (visits > maxVisitsPerNode) {
      continue;
    }

    const outgoing = outgoingBySource.get(current) ?? [];

    for (const edge of outgoing) {
      const nextLevel = currentLevel + 1;
      const previousLevel = levels.get(edge.target);

      if (previousLevel === undefined || nextLevel < previousLevel) {
        levels.set(edge.target, nextLevel);
        queue.push(edge.target);
      }
    }
  }

  const byLevel = new Map<number, Node[]>();

  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    const list = byLevel.get(level) ?? [];
    list.push(node);
    byLevel.set(level, list);
  }

  const positioned = nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const group = byLevel.get(level) ?? [];
    const index = group.findIndex((item) => item.id === node.id);

    return {
      ...node,
      position: {
        x: level * 370,
        y: index * 190,
      },
    };
  });

  return { nodes: positioned, edges };
}
