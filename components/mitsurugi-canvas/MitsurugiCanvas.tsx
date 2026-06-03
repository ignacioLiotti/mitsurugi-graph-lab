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
import { ExternalLink, RotateCcw, Search, Swords, Waypoints } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchYgoCardInfo, getLookupName, YgoCardInfo } from "./cardApi";
import { cards } from "./cards";
import { cardName, editableZones, useGameStateStore } from "./gameStateStore";
import { buildGraph, GraphMode, isActionAvailable } from "./graphEngine";
import { nodeTypes } from "./nodes";
import {
  actionTargets,
  applyPlaygroundAction,
  buildPlaygroundGraph,
  createInitialPlaygroundState,
  PlaygroundStep,
} from "./playgroundEngine";
import { OpponentAction, Zone } from "./types";

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

export default function MitsurugiCanvas() {
  const [appMode, setAppMode] = useState<"map" | "playground">("map");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>("habakiri");
  const [mode, setMode] = useState<GraphMode>("expanded");
  const [includeConditions, setIncludeConditions] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCardInfo, setSelectedCardInfo] = useState<YgoCardInfo | null>(null);
  const [cardInfoStatus, setCardInfoStatus] = useState<"idle" | "loading" | "ready" | "missing">("idle");
  const [playgroundHand, setPlaygroundHand] = useState<string[]>(["habakiri", "prayers"]);
  const [playgroundState, setPlaygroundState] = useState(() => createInitialPlaygroundState(cards, ["habakiri", "prayers"]));
  const [playgroundSteps, setPlaygroundSteps] = useState<PlaygroundStep[]>([]);
  const [playgroundTargets, setPlaygroundTargets] = useState<Record<string, string>>({});
  const [selectedPlaygroundCardId, setSelectedPlaygroundCardId] = useState<string | null>(null);
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
      return buildPlaygroundGraph(cards, playgroundHand, playgroundSteps);
    }

    return buildGraph(cards, selectedCardId, mode, includeConditions, gameState);
  }, [appMode, selectedCardId, mode, includeConditions, gameState, playgroundHand, playgroundSteps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

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

  function resetPlayground(nextHand = playgroundHand) {
    setPlaygroundHand(nextHand);
    setPlaygroundState(createInitialPlaygroundState(cards, nextHand));
    setPlaygroundSteps([]);
    setPlaygroundTargets({});
    setSelectedPlaygroundCardId(null);
  }

  function togglePlaygroundHand(cardId: string) {
    const nextHand = playgroundHand.includes(cardId)
      ? playgroundHand.filter((id) => id !== cardId)
      : [...playgroundHand, cardId];

    resetPlayground(nextHand);
  }

  function takePlaygroundAction(cardId: string, actionId: string, fallbackTargetId?: string) {
    const card = cards.find((item) => item.id === cardId);
    const action = card?.actions.find((item) => item.id === actionId);

    if (!card || !action) return;

    const decisionKey = `${card.id}-${action.id}`;
    const targetId = playgroundTargets[decisionKey] ?? fallbackTargetId;
    const targetCard = targetId ? cards.find((item) => item.id === targetId) : undefined;
    const stepId = `${playgroundSteps.length + 1}-${decisionKey}`;

    setPlaygroundState((current) => applyPlaygroundAction(current, card, action, targetId));
    setPlaygroundSteps((current) => [
      ...current,
      {
        id: stepId,
        sourceCardId: card.id,
        actionId: action.id,
        targetCardId: targetId,
        label: targetCard ? `${action.label} -> ${targetCard.name}` : action.label,
      },
    ]);
  }

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    if (appMode !== "playground") return;

    const cardId = typeof node.data?.cardId === "string" ? node.data.cardId : null;
    setSelectedPlaygroundCardId(cardId);
  }

  return (
    <main
      className={`app-shell ${leftCollapsed ? "left-collapsed" : ""} ${
        rightCollapsed ? "right-collapsed" : ""
      }`}
    >
      <nav className="mobile-nav" aria-label="Navegacion mobile">
        <a href="#cards-panel">Cartas</a>
        <a href="#graph-panel">Grafo</a>
        <a href="#state-panel">Estado</a>
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
            <button className="secondary-button" onClick={() => resetPlayground()}>
              Reiniciar simulación
            </button>
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

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={() => {
            if (appMode === "playground") setSelectedPlaygroundCardId(null);
          }}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
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
                      <li key={step.id}>{step.label}</li>
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
