"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  Node,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { Download, ExternalLink, Library, RotateCcw, Search, Swords, Upload, Waypoints } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchYgoCardInfo, getCardImageUrl, getLookupName, YgoCardInfo } from "./cardApi";
import { cards } from "./cards";
import { cardName, editableZones, useGameStateStore } from "./gameStateStore";
import { buildGraph, GraphMode, isActionAvailable } from "./graphEngine";
import { edgeTypes, nodeTypes } from "./nodes";
import {
  actionTargets,
  applyPlaygroundAction,
  buildPlaygroundGraph,
  buildPlaygroundTimelineGraph,
  createInitialPlaygroundState,
  PlaygroundSnapshot,
  PlaygroundStep,
} from "./playgroundEngine";
import {
  builtInPlaygrounds,
  currentPlaygroundToScenario,
  parsePlaygroundScenario,
  scenarioInitialHand,
  scenarioToGameState,
  scenarioToSteps,
} from "./playgroundScenarios";
import { GameState, OpponentAction, PlaygroundScenario, Zone } from "./types";

type ConcreteZone = Exclude<Zone, "any">;

const zoneLabels: Record<Zone, string> = {
  hand: "Hand",
  field: "Field",
  graveyard: "GY",
  banished: "Banished",
  deck: "Deck",
  extraDeck: "Extra",
  any: "Any",
};

const opponentActions: { value: OpponentAction; label: string }[] = [
  { value: "none", label: "None" },
  { value: "specialSummon", label: "Special Summon" },
  { value: "activatedEffect", label: "Effect" },
];

const nodeLegend = [
  { label: "Carta", className: "legend-card" },
  { label: "Acción", className: "legend-action" },
  { label: "Condición", className: "legend-condition" },
  { label: "Target", className: "legend-wildcard" },
];

const timelineZones: { key: ConcreteZone; label: string }[] = [
  { key: "hand", label: "Hand" },
  { key: "field", label: "Field" },
  { key: "graveyard", label: "GY" },
  { key: "banished", label: "Banish" },
];

const snapshotEditorZones: { key: ConcreteZone; label: string }[] = [
  { key: "hand", label: "Hand" },
  { key: "field", label: "Field" },
  { key: "graveyard", label: "GY" },
  { key: "banished", label: "Banish" },
  { key: "deck", label: "Deck" },
  { key: "extraDeck", label: "Extra" },
];

type SnapshotInspector =
  | { type: "card"; cardId: string }
  | { type: "zone"; zone: ConcreteZone };

type FocusMovement = {
  id: string;
  cardId: string;
  from: ConcreteZone;
  to: ConcreteZone;
};

export default function MitsurugiCanvas() {
  const [appMode, setAppMode] = useState<"map" | "playground">("map");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>("habakiri");
  const [mode, setMode] = useState<GraphMode>("expanded");
  const [playgroundCanvasView, setPlaygroundCanvasView] = useState<"timeline" | "focus" | "decisions">("timeline");
  const [includeConditions, setIncludeConditions] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCardInfo, setSelectedCardInfo] = useState<YgoCardInfo | null>(null);
  const [cardInfoStatus, setCardInfoStatus] = useState<"idle" | "loading" | "ready" | "missing">("idle");
  const [playgroundHand, setPlaygroundHand] = useState<string[]>(["habakiri", "prayers"]);
  const [playgroundState, setPlaygroundState] = useState(() => createInitialPlaygroundState(cards, ["habakiri", "prayers"]));
  const [playgroundSteps, setPlaygroundSteps] = useState<PlaygroundStep[]>([]);
  const [fieldSnapshots, setFieldSnapshots] = useState<PlaygroundSnapshot[]>(() => [
    {
      id: "snapshot-0",
      label: "Initial hand",
      state: createInitialPlaygroundState(cards, ["habakiri", "prayers"]),
    },
  ]);
  const [activeSnapshotIndex, setActiveSnapshotIndex] = useState(0);
  const [playgroundTargets, setPlaygroundTargets] = useState<Record<string, string>>({});
  const [selectedPlaygroundCardId, setSelectedPlaygroundCardId] = useState<string | null>(null);
  const [snapshotInspector, setSnapshotInspector] = useState<SnapshotInspector | null>(null);
  const [cardToAddToSnapshot, setCardToAddToSnapshot] = useState("");
  const [focusMovements, setFocusMovements] = useState<FocusMovement[]>([]);
  const [focusAnimationKey, setFocusAnimationKey] = useState(0);
  const [importedPlaygrounds, setImportedPlaygrounds] = useState<PlaygroundScenario[]>([]);
  const [activePlaygroundId, setActivePlaygroundId] = useState<string>("custom");
  const [playgroundImportStatus, setPlaygroundImportStatus] = useState("");
  const [pastedPlaygroundJson, setPastedPlaygroundJson] = useState("");
  const {
    gameState,
    toggleCardInZone,
    setOpponentAction,
    toggleRitualSummoned,
    reset,
  } = useGameStateStore();

  const visibleCards = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return cards;

    return cards.filter((card) => {
      return (
        card.name.toLowerCase().includes(normalized) ||
        card.summary.toLowerCase().includes(normalized) ||
        card.tags?.some((tag) => tag.toLowerCase().includes(normalized))
      );
    });
  }, [query]);

  const graph = useMemo(() => {
    if (appMode === "playground") {
      if (playgroundCanvasView === "timeline") {
        return buildPlaygroundTimelineGraph(
          cards,
          fieldSnapshots,
          activeSnapshotIndex,
          (cardId) => {
            setSelectedPlaygroundCardId(cardId);
            setSnapshotInspector({ type: "card", cardId });
          },
          (zone) => setSnapshotInspector({ type: "zone", zone }),
        );
      }

      return buildPlaygroundGraph(cards, playgroundHand, playgroundSteps);
    }

    return buildGraph(cards, selectedCardId, mode, includeConditions, gameState);
  }, [
    appMode,
    selectedCardId,
    mode,
    includeConditions,
    gameState,
    playgroundCanvasView,
    fieldSnapshots,
    activeSnapshotIndex,
    playgroundHand,
    playgroundSteps,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  useEffect(() => {
    function isConcreteZone(value: string | null): value is ConcreteZone {
      return snapshotEditorZones.some((zone) => zone.key === value);
    }

    function handleSnapshotNativeEvent(event: Event) {
      const target = event.target instanceof Element ? event.target : null;
      const cardButton = target?.closest<HTMLElement>("[data-card-id]");
      const zoneButton = target?.closest<HTMLElement>("[data-zone]");

      if (cardButton?.dataset.cardId) {
        setSelectedPlaygroundCardId(cardButton.dataset.cardId);
        setSnapshotInspector({ type: "card", cardId: cardButton.dataset.cardId });
        return;
      }

      const zone = zoneButton?.dataset.zone ?? null;
      if (isConcreteZone(zone)) {
        setSnapshotInspector({ type: "zone", zone });
      }
    }

    function handleSnapshotCard(event: Event) {
      const detail = (event as CustomEvent<{ cardId?: string }>).detail;
      if (!detail?.cardId) return;
      setSelectedPlaygroundCardId(detail.cardId);
      setSnapshotInspector({ type: "card", cardId: detail.cardId });
    }

    function handleSnapshotZone(event: Event) {
      const detail = (event as CustomEvent<{ zone?: ConcreteZone }>).detail;
      if (!detail?.zone) return;
      setSnapshotInspector({ type: "zone", zone: detail.zone });
    }

    document.addEventListener("pointerdown", handleSnapshotNativeEvent, true);
    document.addEventListener("mousedown", handleSnapshotNativeEvent, true);
    document.addEventListener("click", handleSnapshotNativeEvent, true);
    window.addEventListener("mitsurugi:snapshot-card", handleSnapshotCard);
    window.addEventListener("mitsurugi:snapshot-zone", handleSnapshotZone);

    return () => {
      document.removeEventListener("pointerdown", handleSnapshotNativeEvent, true);
      document.removeEventListener("mousedown", handleSnapshotNativeEvent, true);
      document.removeEventListener("click", handleSnapshotNativeEvent, true);
      window.removeEventListener("mitsurugi:snapshot-card", handleSnapshotCard);
      window.removeEventListener("mitsurugi:snapshot-zone", handleSnapshotZone);
    };
  }, []);

  const selectedCard = cards.find((card) => card.id === selectedCardId);

  useEffect(() => {
    if (!selectedCard) {
      setSelectedCardInfo(null);
      setCardInfoStatus("idle");
      return;
    }

    const controller = new AbortController();

    setCardInfoStatus("loading");
    fetchYgoCardInfo(selectedCard, controller.signal)
      .then((cardInfo) => {
        setSelectedCardInfo(cardInfo);
        setCardInfoStatus(cardInfo ? "ready" : "missing");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSelectedCardInfo(null);
        setCardInfoStatus("missing");
      });

    return () => controller.abort();
  }, [selectedCard]);

  const legalActions = useMemo(() => {
    return cards.flatMap((card) =>
      card.actions
        .filter((action) => isActionAvailable(cards, gameState, card, action))
        .map((action) => ({ card, action })),
    );
  }, [gameState]);

  const playgroundLegalActions = useMemo(() => {
    const allActions = cards.flatMap((card) =>
      card.actions
        .filter((action) => isActionAvailable(cards, playgroundState, card, action))
        .map((action) => ({
          card,
          action,
          targets: actionTargets(cards, playgroundState, action),
        })),
    );

    if (!selectedPlaygroundCardId) return allActions;
    return allActions.filter(({ card }) => card.id === selectedPlaygroundCardId);
  }, [playgroundState, selectedPlaygroundCardId]);

  const selectedPlaygroundCard = selectedPlaygroundCardId
    ? cards.find((card) => card.id === selectedPlaygroundCardId)
    : undefined;

  const playgroundLibrary = useMemo(
    () => [...builtInPlaygrounds, ...importedPlaygrounds],
    [importedPlaygrounds],
  );

  const activeSnapshot = fieldSnapshots[Math.min(activeSnapshotIndex, fieldSnapshots.length - 1)];
  const inspectedCard =
    snapshotInspector?.type === "card" ? cards.find((card) => card.id === snapshotInspector.cardId) : undefined;
  const inspectedZoneCards =
    activeSnapshot && snapshotInspector?.type === "zone"
      ? activeSnapshot.state[snapshotInspector.zone]
          .map((cardId) => cards.find((card) => card.id === cardId))
          .filter((card): card is (typeof cards)[number] => Boolean(card))
      : [];

  function makeInitialSnapshot(state: GameState): PlaygroundSnapshot {
    return {
      id: "snapshot-0",
      label: "Initial hand",
      state,
    };
  }

  function buildSnapshotsFromSteps(initialState: GameState, steps: PlaygroundStep[]) {
    let rollingState = initialState;
    const snapshots: PlaygroundSnapshot[] = [makeInitialSnapshot(initialState)];

    steps.forEach((step, index) => {
      const sourceCard = cards.find((card) => card.id === step.sourceCardId);
      const action = sourceCard?.actions.find((item) => item.id === step.actionId);
      if (!sourceCard || !action) return;

      rollingState = applyPlaygroundAction(rollingState, sourceCard, action, step.targetCardId, step.materials);
      snapshots.push({
        id: `snapshot-${index + 1}-${step.id}`,
        label: step.label,
        description: step.description,
        effectName: step.effectName,
        effectNumber: step.effectNumber,
        materials: step.materials,
        state: rollingState,
        sourceCardId: step.sourceCardId,
        targetCardId: step.targetCardId,
      });
    });

    return snapshots;
  }

  function resetPlayground(nextHand = playgroundHand) {
    const nextState = createInitialPlaygroundState(cards, nextHand);

    setPlaygroundHand(nextHand);
    setPlaygroundState(nextState);
    setPlaygroundSteps([]);
    setFieldSnapshots([makeInitialSnapshot(nextState)]);
    setActiveSnapshotIndex(0);
    setPlaygroundTargets({});
    setSelectedPlaygroundCardId(null);
    setSnapshotInspector(null);
    setActivePlaygroundId("custom");
  }

  function togglePlaygroundHand(cardId: string) {
    const nextHand = playgroundHand.includes(cardId)
      ? playgroundHand.filter((id) => id !== cardId)
      : [...playgroundHand, cardId];

    resetPlayground(nextHand);
  }

  function loadPlaygroundScenario(scenario: PlaygroundScenario) {
    const nextHand = scenarioInitialHand(cards, scenario);
    const nextSteps = scenarioToSteps(cards, scenario);
    const explicitState = scenarioToGameState(cards, scenario);
    const initialState = scenario.gameState ? explicitState : createInitialPlaygroundState(cards, nextHand);
    const snapshots = nextSteps.length
      ? buildSnapshotsFromSteps(initialState, nextSteps)
      : [makeInitialSnapshot(explicitState)];
    const finalState = snapshots[snapshots.length - 1]?.state ?? explicitState;

    setPlaygroundHand(nextHand);
    setPlaygroundState(finalState);
    setPlaygroundSteps(nextSteps);
    setFieldSnapshots(snapshots);
    setActiveSnapshotIndex(snapshots.length - 1);
    setPlaygroundTargets({});
    setSelectedPlaygroundCardId(null);
    setSnapshotInspector(null);
    setActivePlaygroundId(scenario.id);
    setPlaygroundImportStatus(`Cargado: ${scenario.name}`);
  }

  function handlePlaygroundLibraryChange(scenarioId: string) {
    if (scenarioId === "custom") {
      setActivePlaygroundId("custom");
      return;
    }

    const scenario = playgroundLibrary.find((item) => item.id === scenarioId);
    if (scenario) loadPlaygroundScenario(scenario);
  }

  function loadParsedScenario(value: unknown, shouldClearText = false) {
    const parsed = parsePlaygroundScenario(value);

    if (!parsed.ok) {
      setPlaygroundImportStatus(parsed.error);
      return;
    }

    setImportedPlaygrounds((current) => [
      ...current.filter((item) => item.id !== parsed.scenario.id),
      parsed.scenario,
    ]);
    loadPlaygroundScenario(parsed.scenario);

    if (shouldClearText) {
      setPastedPlaygroundJson("");
    }
  }

  async function importPlaygroundJson(file: File | null) {
    if (!file) return;

    try {
      loadParsedScenario(JSON.parse(await file.text()));
    } catch {
      setPlaygroundImportStatus("No pude leer ese JSON.");
    }
  }

  function importPlaygroundJsonText() {
    if (!pastedPlaygroundJson.trim()) {
      setPlaygroundImportStatus("Pegá un JSON antes de importarlo.");
      return;
    }

    try {
      loadParsedScenario(JSON.parse(pastedPlaygroundJson), true);
    } catch {
      setPlaygroundImportStatus("El texto pegado no es JSON válido.");
    }
  }

  function exportCurrentPlayground() {
    const scenario = currentPlaygroundToScenario(
      `export-${Date.now()}`,
      "Playground export",
      playgroundHand,
      playgroundState,
      playgroundSteps,
    );
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "mitsurugi-playground.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function takePlaygroundAction(cardId: string, actionId: string, fallbackTargetId?: string) {
    const card = cards.find((item) => item.id === cardId);
    const action = card?.actions.find((item) => item.id === actionId);

    if (!card || !action) return;

    const decisionKey = `${card.id}-${action.id}`;
    const targetId = playgroundTargets[decisionKey] ?? fallbackTargetId;
    const targetCard = targetId ? cards.find((item) => item.id === targetId) : undefined;
    const stepId = `${playgroundSteps.length + 1}-${decisionKey}`;
    const nextState = applyPlaygroundAction(playgroundState, card, action, targetId);
    const nextStep = {
      id: stepId,
      sourceCardId: card.id,
      actionId: action.id,
      targetCardId: targetId,
      label: targetCard ? `${action.label} -> ${targetCard.name}` : action.label,
      description: action.note,
    };

    setPlaygroundState(nextState);
    setPlaygroundSteps((current) => [...current, nextStep]);
    setFieldSnapshots((current) => [
      ...current,
      {
        id: `snapshot-${current.length}-${stepId}`,
        label: nextStep.label,
        description: nextStep.description,
        state: nextState,
        sourceCardId: nextStep.sourceCardId,
        targetCardId: nextStep.targetCardId,
      },
    ]);
    setActiveSnapshotIndex(fieldSnapshots.length);
    setActivePlaygroundId("custom");
  }

  function removeCardFromSnapshotState(state: GameState, cardId: string): GameState {
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

  function trimTimelineWithEditedState(nextState: GameState, label = "Edited state") {
    const baseSnapshots = fieldSnapshots.slice(0, activeSnapshotIndex + 1);
    const currentSnapshot = baseSnapshots[activeSnapshotIndex] ?? makeInitialSnapshot(nextState);
    const nextSnapshots = [
      ...baseSnapshots.slice(0, activeSnapshotIndex),
      {
        ...currentSnapshot,
        label,
        state: nextState,
      },
    ];

    setFieldSnapshots(nextSnapshots);
    setPlaygroundSteps((current) => current.slice(0, Math.max(activeSnapshotIndex, 0)));
    setPlaygroundState(nextState);
    setActiveSnapshotIndex(nextSnapshots.length - 1);
    setActivePlaygroundId("custom");
  }

  function moveCardInActiveSnapshot(cardId: string, zone: ConcreteZone) {
    if (!activeSnapshot) return;

    const withoutCard = removeCardFromSnapshotState(activeSnapshot.state, cardId);
    const nextState = {
      ...withoutCard,
      [zone]: [...withoutCard[zone], cardId],
    };

    trimTimelineWithEditedState(nextState, `${activeSnapshot.label} (edited)`);
  }

  function removeCardFromActiveSnapshot(cardId: string) {
    if (!activeSnapshot) return;
    trimTimelineWithEditedState(removeCardFromSnapshotState(activeSnapshot.state, cardId), `${activeSnapshot.label} (edited)`);
  }

  function addCardToActiveSnapshot(zone: ConcreteZone) {
    if (!activeSnapshot || !cardToAddToSnapshot) return;
    moveCardInActiveSnapshot(cardToAddToSnapshot, zone);
    setCardToAddToSnapshot("");
  }

  function cardZoneInState(state: GameState, cardId: string): ConcreteZone | null {
    return snapshotEditorZones.find((zone) => state[zone.key].includes(cardId))?.key ?? null;
  }

  function snapshotMovements(from: PlaygroundSnapshot | undefined, to: PlaygroundSnapshot | undefined) {
    if (!from || !to) return [];

    const allCardIds = new Set([
      ...from.state.hand,
      ...from.state.field,
      ...from.state.graveyard,
      ...from.state.banished,
      ...from.state.deck,
      ...from.state.extraDeck,
      ...to.state.hand,
      ...to.state.field,
      ...to.state.graveyard,
      ...to.state.banished,
      ...to.state.deck,
      ...to.state.extraDeck,
    ]);

    return Array.from(allCardIds).flatMap((cardId) => {
      const fromZone = cardZoneInState(from.state, cardId);
      const toZone = cardZoneInState(to.state, cardId);

      if (!fromZone || !toZone || fromZone === toZone) return [];
      return [
        {
          id: `${cardId}-${from.id}-${to.id}`,
          cardId,
          from: fromZone,
          to: toZone,
        },
      ];
    });
  }

  function goToSnapshot(index: number) {
    const nextIndex = Math.max(0, Math.min(fieldSnapshots.length - 1, index));
    const movements = snapshotMovements(fieldSnapshots[activeSnapshotIndex], fieldSnapshots[nextIndex]);

    setFocusMovements(movements);
    setFocusAnimationKey((value) => value + 1);
    setActiveSnapshotIndex(nextIndex);

    window.setTimeout(() => {
      setFocusMovements([]);
    }, 1400);
  }

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    if (appMode !== "playground") return;

    const snapshotIndex = typeof node.data?.snapshotIndex === "number" ? node.data.snapshotIndex : null;
    if (snapshotIndex !== null) {
      goToSnapshot(snapshotIndex);
      return;
    }

    const cardId = typeof node.data?.cardId === "string" ? node.data.cardId : null;
    setSelectedPlaygroundCardId(cardId);
    if (cardId) setSnapshotInspector({ type: "card", cardId });
  }

  function renderMiniCard(cardId: string, mode: "image" | "chip" = "image") {
    const card = cards.find((item) => item.id === cardId);
    if (!card) return null;

    if (mode === "chip") {
      return (
        <span key={cardId} className="field-chip" title={card.name}>
          {card.name.replace("Ame no ", "").replace(" no Mitsurugi", "")}
        </span>
      );
    }

    return (
      <img
        key={cardId}
        src={getCardImageUrl(card)}
        alt={card.name}
        title={card.name}
        className="field-card-image"
      />
    );
  }

  function renderStack(label: string, count: number) {
    return (
      <div className="field-stack">
        <div className="field-card-back" />
        <strong>{label}</strong>
        <span>{count}</span>
      </div>
    );
  }

  function renderSnapshotBoard(snapshot: PlaygroundSnapshot, compact = false) {
    const fieldCards = snapshot.state.field.slice(0, compact ? 3 : 5);

    return (
      <div className={compact ? "field-board compact-field-board" : "field-board"}>
        <div className="field-board-top">
          {renderStack("Deck", snapshot.state.deck.length)}
          <div className="field-zone main-field-zone">
            <span>Monster / Spell zones</span>
            <div className="field-slots">
              {Array.from({ length: compact ? 3 : 5 }).map((_, index) => (
                <div key={index} className="field-slot">
                  {fieldCards[index] ? renderMiniCard(fieldCards[index]) : <span className="empty-slot" />}
                </div>
              ))}
            </div>
          </div>
          {renderStack("Extra", snapshot.state.extraDeck.length)}
        </div>

        <div className="field-board-bottom">
          {timelineZones.map((zone) => (
            <div key={zone.key} className="field-zone">
              <span>
                {zone.label} {snapshot.state[zone.key].length}
              </span>
              <div className="field-zone-cards">
                {snapshot.state[zone.key].slice(0, compact ? 4 : 8).map((cardId) => renderMiniCard(cardId, "chip"))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderFocusCard(cardId: string, highlighted = false) {
    const card = cards.find((item) => item.id === cardId);
    if (!card) return null;

    return (
      <button
        key={card.id}
        className={highlighted ? "focus-card-button focus-card-highlight" : "focus-card-button"}
        onClick={() => {
          setSelectedPlaygroundCardId(card.id);
          setSnapshotInspector({ type: "card", cardId: card.id });
        }}
        title={card.name}
      >
        <img src={getCardImageUrl(card)} alt={card.name} />
      </button>
    );
  }

  function renderFocusStack(snapshot: PlaygroundSnapshot, zone: ConcreteZone, label: string, highlighted = false) {
    return (
      <button
        className={highlighted ? "focus-stack focus-stack-highlight" : "focus-stack"}
        onClick={() => setSnapshotInspector({ type: "zone", zone })}
      >
        <div className="snapshot-card-back" />
        <strong>{label}</strong>
        <span>{snapshot.state[zone].length}</span>
      </button>
    );
  }

  function renderFocusSnapshot(snapshot: PlaygroundSnapshot) {
    const fieldCards = snapshot.state.field.slice(0, 10);
    const highlightedCardIds = new Set(focusMovements.map((movement) => movement.cardId));
    const highlightedZones = new Set(focusMovements.flatMap((movement) => [movement.from, movement.to]));

    return (
      <div className="focus-board-shell">
        <div className="focus-board-header">
          <div>
            <strong>T{activeSnapshotIndex}</strong>
            <span>{snapshot.label}</span>
          </div>
          {(snapshot.effectName || snapshot.description) && (
            <p>
              {snapshot.effectName
                ? `${typeof snapshot.effectNumber === "number" ? `E${snapshot.effectNumber}: ` : ""}${snapshot.effectName}`
                : ""}
              {snapshot.description ? ` ${snapshot.description}` : ""}
            </p>
          )}
        </div>

        <div className="focus-board-main">
          <div className="focus-side-stacks">
            {renderFocusStack(snapshot, "extraDeck", "Extra", highlightedZones.has("extraDeck"))}
            {renderFocusStack(snapshot, "field", "Field", highlightedZones.has("field"))}
          </div>

          <div className="focus-field-zone">
            <span>Field</span>
            <div className="focus-field-slots">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="focus-field-slot">
                  {fieldCards[index] ? (
                    renderFocusCard(fieldCards[index], highlightedCardIds.has(fieldCards[index]))
                  ) : (
                    <span className={highlightedZones.has("field") ? "snapshot-empty-slot snapshot-slot-highlight" : "snapshot-empty-slot"} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="focus-side-stacks">
            {renderFocusStack(snapshot, "deck", "Deck", highlightedZones.has("deck"))}
            {renderFocusStack(snapshot, "graveyard", "GY", highlightedZones.has("graveyard"))}
            {renderFocusStack(snapshot, "banished", "Banish", highlightedZones.has("banished"))}
          </div>
        </div>

        <div className="focus-hand-zone">
          <span>Hand {snapshot.state.hand.length}</span>
          <div>{snapshot.state.hand.map((cardId) => renderFocusCard(cardId, highlightedCardIds.has(cardId)))}</div>
        </div>

        <div className="focus-movement-layer" key={focusAnimationKey}>
          {focusMovements.map((movement) => {
            const card = cards.find((item) => item.id === movement.cardId);
            if (!card) return null;

            return (
              <div
                key={movement.id}
                className={`focus-moving-card move-from-${movement.from} move-to-${movement.to}`}
                title={`${card.name}: ${movement.from} -> ${movement.to}`}
              >
                <img src={getCardImageUrl(card)} alt={card.name} />
                <span>
                  {movement.from} → {movement.to}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main
      className={`app-shell app-mode-${appMode} canvas-${playgroundCanvasView} ${leftCollapsed ? "left-collapsed" : ""} ${
        rightCollapsed ? "right-collapsed" : ""
      }`}
    >
      <nav className="mobile-nav" aria-label="Navegacion mobile">
        <a href="#cards-panel">Cartas</a>
        <a href="#graph-panel">Grafo</a>
        <a href="#state-panel">Estado</a>
        <button type="button" onClick={() => setLeftCollapsed((value) => !value)}>
          {leftCollapsed ? "Abrir cartas" : "Cerrar cartas"}
        </button>
        <button type="button" onClick={() => setRightCollapsed((value) => !value)}>
          {rightCollapsed ? "Abrir estado" : "Cerrar estado"}
        </button>
      </nav>

      <aside className="sidebar" id="cards-panel">
        <button className="collapse-tab collapse-tab-left" onClick={() => setLeftCollapsed((value) => !value)}>
          {leftCollapsed ? "Mostrar cartas" : "Ocultar"}
        </button>
        <div className="sidebar-inner">
        <div className="brand-panel">
          <div className="brand-title">
            <Waypoints size={20} />
            <h1>Mitsurugi Graph Lab</h1>
          </div>
          <p>Árbol editable de cartas, acciones, condiciones y targets legales.</p>
        </div>

        <div className="control-panel">
          <div className="field-label">Vista</div>
          <div className="segmented">
            <button className={appMode === "map" ? "active" : ""} onClick={() => setAppMode("map")}>
              Mapa
            </button>
            <button className={appMode === "playground" ? "active" : ""} onClick={() => setAppMode("playground")}>
              Playground
            </button>
          </div>

          {appMode === "map" ? (
            <>
          <div className="field-label">Modo</div>
          <div className="segmented">
            <button className={mode === "expanded" ? "active" : ""} onClick={() => setMode("expanded")}>
              Expandido
            </button>
            <button className={mode === "direct" ? "active" : ""} onClick={() => setMode("direct")}>
              Directo
            </button>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={includeConditions}
              onChange={(event) => setIncludeConditions(event.target.checked)}
            />
            Mostrar condiciones
          </label>

          <button className="secondary-button" onClick={() => setSelectedCardId(null)}>
            Ver todas las cartas
          </button>
            </>
          ) : (
            <>
              <div className="field-label">Canvas</div>
              <div className="segmented segmented-three">
                <button
                  className={playgroundCanvasView === "timeline" ? "active" : ""}
                  onClick={() => setPlaygroundCanvasView("timeline")}
                >
                  Timeline
                </button>
                <button
                  className={playgroundCanvasView === "focus" ? "active" : ""}
                  onClick={() => setPlaygroundCanvasView("focus")}
                >
                  Focus
                </button>
                <button
                  className={playgroundCanvasView === "decisions" ? "active" : ""}
                  onClick={() => setPlaygroundCanvasView("decisions")}
                >
                  Decisions
                </button>
              </div>

              <button className="secondary-button" onClick={() => resetPlayground()}>
                Reiniciar simulación
              </button>
            </>
          )}
        </div>

        <div className="search-panel">
          <div className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar carta, tag o efecto..."
            />
          </div>
        </div>

        <div className="card-list">
          {visibleCards.map((card) => (
            <button
              key={card.id}
              onClick={() => setSelectedCardId(card.id)}
              className={`card-list-item ${selectedCardId === card.id ? "selected" : ""}`}
            >
              <span>{card.name}</span>
              <small>{card.cardType}</small>
              <p>{card.summary}</p>
            </button>
          ))}
        </div>
        </div>
      </aside>

      <section className="canvas-area" id="graph-panel">
        <div className="top-card">
          <div>
            <strong>
              {appMode === "playground"
                ? "Playground de partida"
                : selectedCard
                  ? selectedCard.name
                  : "Todas las cartas"}
            </strong>
            <p>
              {appMode === "playground"
                ? "Tomá decisiones legales y construí una línea paso a paso."
                : selectedCard
                  ? selectedCard.summary
                  : "Vista completa del motor de dependencias."}
            </p>
          </div>
          <div className="legal-counter">
            <Swords size={16} />
            {appMode === "playground" ? playgroundLegalActions.length : legalActions.length} legales
          </div>
        </div>

        <div className="node-legend" aria-label="Leyenda de nodos">
          {nodeLegend.map((item) => (
            <div key={item.label} className="legend-item">
              <span className={item.className} />
              {item.label}
            </div>
          ))}
        </div>

        {appMode === "playground" && playgroundCanvasView === "focus" && activeSnapshot ? (
          <div className="focus-timeline-view">
            <button
              className="focus-nav-button"
              disabled={activeSnapshotIndex === 0}
              onClick={() => goToSnapshot(activeSnapshotIndex - 1)}
            >
              Previous
            </button>
            {renderFocusSnapshot(activeSnapshot)}
            <button
              className="focus-nav-button"
              disabled={activeSnapshotIndex >= fieldSnapshots.length - 1}
              onClick={() => goToSnapshot(activeSnapshotIndex + 1)}
            >
              Next
            </button>
          </div>
        ) : (
          <ReactFlow
            key={`${appMode}-${playgroundCanvasView}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={() => {
              if (appMode === "playground") setSelectedPlaygroundCardId(null);
            }}
            defaultViewport={{
              x: appMode === "playground" && playgroundCanvasView === "timeline" ? -116 : 0,
              y: appMode === "playground" && playgroundCanvasView === "timeline" ? 88 : 0,
              zoom: appMode === "playground" && playgroundCanvasView === "timeline" ? 0.72 : 1,
            }}
            fitView={!(appMode === "playground" && playgroundCanvasView === "timeline")}
            fitViewOptions={{
              padding: appMode === "playground" && playgroundCanvasView === "timeline" ? 1.1 : 0.2,
            }}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        )}
      </section>

      <aside className="state-panel" id="state-panel">
        <button className="collapse-tab collapse-tab-right" onClick={() => setRightCollapsed((value) => !value)}>
          {rightCollapsed ? "Mostrar panel" : "Ocultar"}
        </button>
        <div className="state-panel-inner">
        {appMode === "playground" ? (
          <>
            <div className="playground-panel">
              <div className="state-header compact-state-header">
                <div>
                  <h2>Playground</h2>
                  <p>Elegí mano inicial y ejecutá acciones legales.</p>
                </div>
                <button className="icon-button" onClick={() => resetPlayground()} title="Reset">
                  <RotateCcw size={16} />
                </button>
              </div>

              <div className="playground-section">
                <div className="field-label">Biblioteca</div>
                <div className="scenario-tools">
                  <div className="scenario-select-row">
                    <Library size={15} />
                    <select
                      value={activePlaygroundId}
                      onChange={(event) => handlePlaygroundLibraryChange(event.target.value)}
                    >
                      <option value="custom">Playground actual</option>
                      {playgroundLibrary.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="scenario-actions-row">
                    <label className="scenario-file-button">
                      <Upload size={14} />
                      Importar JSON
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(event) => importPlaygroundJson(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <button className="scenario-file-button" onClick={exportCurrentPlayground}>
                      <Download size={14} />
                      Exportar
                    </button>
                  </div>

                  <div className="scenario-paste-box">
                    <textarea
                      value={pastedPlaygroundJson}
                      onChange={(event) => setPastedPlaygroundJson(event.target.value)}
                      placeholder='Pegá un escenario JSON: {"schemaVersion":1,"id":"..."}'
                      spellCheck={false}
                    />
                    <button onClick={importPlaygroundJsonText}>Importar texto pegado</button>
                  </div>

                  <p>
                    {playgroundImportStatus ||
                      "Formato: schemaVersion, id, name, initialHand, gameState y steps opcionales."}
                  </p>
                </div>
              </div>

              <div className="playground-section">
                <div className="field-label">Mano inicial</div>
                <div className="zone-grid playground-hand-grid">
                  {cards
                    .filter((card) => card.kind !== "extra")
                    .map((card) => (
                      <button
                        key={card.id}
                        className={playgroundHand.includes(card.id) ? "zone-pill selected" : "zone-pill"}
                        onClick={() => togglePlaygroundHand(card.id)}
                      >
                        {card.name.replace("Ame no ", "").replace(" no Mitsurugi", "")}
                      </button>
                    ))}
                </div>
              </div>

              <div className="playground-section">
                <div className="field-label">Estado actual</div>
                <div className="playground-zones">
                  <span>Hand {playgroundState.hand.length}</span>
                  <span>Field {playgroundState.field.length}</span>
                  <span>GY {playgroundState.graveyard.length}</span>
                  <span>Deck {playgroundState.deck.length}</span>
                </div>
              </div>

              <div className="playground-section">
                <div className="field-label">Field timeline</div>
                {activeSnapshot ? (
                  <div className="field-timeline">
                    <div className="field-timeline-header">
                      <strong>
                        T{activeSnapshotIndex}: {activeSnapshot.label}
                      </strong>
                      <span>
                        {fieldSnapshots.length} state{fieldSnapshots.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {renderSnapshotBoard(activeSnapshot)}

                    <div className="snapshot-strip" aria-label="Field states over time">
                      {fieldSnapshots.map((snapshot, index) => (
                        <button
                          key={snapshot.id}
                          className={index === activeSnapshotIndex ? "snapshot-card active" : "snapshot-card"}
                          onClick={() => goToSnapshot(index)}
                        >
                          <span>T{index}</span>
                          {renderSnapshotBoard(snapshot, true)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="empty-copy">No hay snapshots todavia.</p>
                )}
              </div>

              <div className="playground-section">
                <div className="field-label">Snapshot inspector</div>
                <div className="snapshot-inspector">
                  {snapshotInspector?.type === "card" && inspectedCard ? (
                    <div className="snapshot-card-detail">
                      <img src={getCardImageUrl(inspectedCard)} alt={inspectedCard.name} />
                      <div>
                        <strong>{inspectedCard.name}</strong>
                        <span>{inspectedCard.cardType}</span>
                        <p>{inspectedCard.summary}</p>
                      </div>
                    </div>
                  ) : snapshotInspector?.type === "zone" ? (
                    <div className="snapshot-zone-detail">
                      <strong>{zoneLabels[snapshotInspector.zone]}</strong>
                      <span>{inspectedZoneCards.length} cards in selected snapshot</span>
                      <div className="snapshot-zone-preview-grid">
                        {inspectedZoneCards.map((card) => (
                          <button
                            key={card.id}
                            onClick={() => {
                              setSelectedPlaygroundCardId(card.id);
                              setSnapshotInspector({ type: "card", cardId: card.id });
                            }}
                          >
                            <img src={getCardImageUrl(card)} alt={card.name} />
                            <span>{card.name.replace("Ame no ", "").replace(" no Mitsurugi", "")}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="empty-copy">Click a board, card, or stack in the canvas.</p>
                  )}

                  {activeSnapshot ? (
                    <div className="snapshot-editor">
                      <div className="field-label">Edit active snapshot</div>
                      {snapshotInspector?.type === "card" && inspectedCard ? (
                        <>
                          <div className="snapshot-move-grid">
                            {snapshotEditorZones.map((zone) => (
                              <button key={zone.key} onClick={() => moveCardInActiveSnapshot(inspectedCard.id, zone.key)}>
                                Move to {zone.label}
                              </button>
                            ))}
                          </div>
                          <button className="snapshot-remove-button" onClick={() => removeCardFromActiveSnapshot(inspectedCard.id)}>
                            Remove from snapshot
                          </button>
                        </>
                      ) : null}

                      {snapshotInspector?.type === "zone" ? (
                        <div className="snapshot-add-row">
                          <select
                            value={cardToAddToSnapshot}
                            onChange={(event) => setCardToAddToSnapshot(event.target.value)}
                          >
                            <option value="">Add card...</option>
                            {cards.map((card) => (
                              <option key={card.id} value={card.id}>
                                {card.name}
                              </option>
                            ))}
                          </select>
                          <button onClick={() => addCardToActiveSnapshot(snapshotInspector.zone)}>Add</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="playground-section">
                <div className="field-label">Decisiones legales</div>
                <div className="playground-filter">
                  {selectedPlaygroundCard ? (
                    <>
                      <span>Filtrando por {selectedPlaygroundCard.name}</span>
                      <button onClick={() => setSelectedPlaygroundCardId(null)}>Ver todas</button>
                    </>
                  ) : (
                    <span>Seleccioná un nodo de carta para filtrar sus decisiones.</span>
                  )}
                </div>
                <div className="playground-actions">
                  {playgroundLegalActions.length ? (
                    playgroundLegalActions.map(({ card, action, targets }) => {
                      const decisionKey = `${card.id}-${action.id}`;
                      const selectedTargetId = playgroundTargets[decisionKey] ?? targets[0]?.id;

                      return (
                        <div key={decisionKey} className="playground-action">
                          <strong>{card.name}</strong>
                          <span>{action.label}</span>
                          {targets.length ? (
                            <select
                              value={selectedTargetId ?? ""}
                              onChange={(event) =>
                                setPlaygroundTargets((current) => ({
                                  ...current,
                                  [decisionKey]: event.target.value,
                                }))
                              }
                            >
                              {targets.map((target) => (
                                <option key={target.id} value={target.id}>
                                  {target.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <button onClick={() => takePlaygroundAction(card.id, action.id, selectedTargetId)}>
                            Ejecutar
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="empty-copy">No hay decisiones legales con este estado.</p>
                  )}
                </div>
              </div>

              <div className="playground-section">
                <div className="field-label">Línea tomada</div>
                {playgroundSteps.length ? (
                  <ol className="playground-log">
                    {playgroundSteps.map((step) => (
                      <li key={step.id}>
                        <strong>{step.label}</strong>
                        {step.description ? <p>{step.description}</p> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="empty-copy">Todavía no ejecutaste ninguna decisión.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
        <div className="card-preview-panel">
          <div className="field-label">Carta seleccionada</div>
          {selectedCard ? (
            <div className="card-preview">
              <div className="card-art-frame">
                {selectedCardInfo?.card_images?.[0]?.image_url ? (
                  <img
                    src={selectedCardInfo.card_images[0].image_url}
                    alt={selectedCardInfo.name}
                    className="card-art"
                  />
                ) : (
                  <div className="card-art-placeholder">
                    {cardInfoStatus === "loading" ? "Cargando imagen..." : "Sin imagen"}
                  </div>
                )}
              </div>

              <div className="card-preview-body">
                <div className="preview-title-row">
                  <h2>{selectedCardInfo?.name ?? selectedCard.name}</h2>
                  {selectedCardInfo ? (
                    <a
                      className="preview-link"
                      href={`https://ygoprodeck.com/card/${selectedCardInfo.id}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir en YGOPRODeck"
                    >
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </div>
                <div className="preview-subtitle">
                  {selectedCardInfo?.type ?? selectedCard.cardType ?? getLookupName(selectedCard)}
                </div>
                {selectedCardInfo ? (
                  <div className="preview-stats">
                    {selectedCardInfo.attribute ? <span>{selectedCardInfo.attribute}</span> : null}
                    {selectedCardInfo.race ? <span>{selectedCardInfo.race}</span> : null}
                    {selectedCardInfo.level ? <span>Level {selectedCardInfo.level}</span> : null}
                    {typeof selectedCardInfo.atk === "number" ? <span>ATK {selectedCardInfo.atk}</span> : null}
                    {typeof selectedCardInfo.def === "number" ? <span>DEF {selectedCardInfo.def}</span> : null}
                  </div>
                ) : null}
                <p className="preview-desc">
                  {selectedCardInfo?.desc ??
                    (cardInfoStatus === "loading"
                      ? "Consultando YGOPRODeck..."
                      : "No encontré esta carta en la API con el nombre actual.")}
                </p>
              </div>
            </div>
          ) : (
            <p className="empty-copy">Seleccioná una carta para cargar su arte y texto oficial.</p>
          )}
        </div>

        <div className="state-header">
          <div>
            <h2>Estado de partida</h2>
            <p>Marcá dónde está cada carta para recalcular acciones.</p>
          </div>
          <button className="icon-button" onClick={reset} title="Reset">
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="opponent-control">
          <div className="field-label">Acción rival</div>
          <div className="segmented compact">
            {opponentActions.map((action) => (
              <button
                key={action.value}
                className={gameState.opponentAction === action.value ? "active" : ""}
                onClick={() => setOpponentAction(action.value)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="zone-editor">
          {editableZones.map((zone) => {
            const zoneKey = zone as ConcreteZone;

            return (
            <div key={zoneKey} className="zone-row">
              <div className="zone-title">{zoneLabels[zoneKey]}</div>
              <div className="zone-grid">
                {cards.map((card) => (
                  <button
                    key={card.id}
                    className={gameState[zoneKey].includes(card.id) ? "zone-pill selected" : "zone-pill"}
                    onClick={() => toggleCardInZone(zoneKey, card.id)}
                    title={card.name}
                  >
                    {card.name.replace("Ame no ", "").replace(" no Mitsurugi", "")}
                  </button>
                ))}
              </div>
            </div>
          )})}
        </div>

        <div className="ritual-panel">
          <div className="field-label">Properly Ritual Summoned</div>
          <div className="zone-grid">
            {cards
              .filter((card) => card.cardType?.includes("Ritual Monster"))
              .map((card) => (
                <button
                  key={card.id}
                  className={gameState.ritualSummoned.includes(card.id) ? "zone-pill selected" : "zone-pill"}
                  onClick={() => toggleRitualSummoned(card.id)}
                >
                  {cardName(card.id).replace("Ame no ", "").replace(" no Mitsurugi", "")}
                </button>
              ))}
          </div>
        </div>

        <div className="legal-list">
          <div className="field-label">Acciones disponibles</div>
          {legalActions.length ? (
            legalActions.slice(0, 10).map(({ card, action }) => (
              <div key={`${card.id}-${action.id}`} className="legal-item">
                <strong>{card.name}</strong>
                <span>{action.label}</span>
              </div>
            ))
          ) : (
            <p className="empty-copy">No hay acciones legales con este estado.</p>
          )}
        </div>
          </>
        )}
        </div>
      </aside>
    </main>
  );
}
