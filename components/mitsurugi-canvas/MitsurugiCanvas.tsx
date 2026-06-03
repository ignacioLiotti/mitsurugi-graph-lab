"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
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
  const [selectedCardId, setSelectedCardId] = useState<string | null>("habakiri");
  const [mode, setMode] = useState<GraphMode>("expanded");
  const [includeConditions, setIncludeConditions] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCardInfo, setSelectedCardInfo] = useState<YgoCardInfo | null>(null);
  const [cardInfoStatus, setCardInfoStatus] = useState<"idle" | "loading" | "ready" | "missing">("idle");
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
    return buildGraph(cards, selectedCardId, mode, includeConditions, gameState);
  }, [selectedCardId, mode, includeConditions, gameState]);

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

  return (
    <main className="app-shell">
      <nav className="mobile-nav" aria-label="Navegacion mobile">
        <a href="#cards-panel">Cartas</a>
        <a href="#graph-panel">Grafo</a>
        <a href="#state-panel">Estado</a>
      </nav>

      <aside className="sidebar" id="cards-panel">
        <div className="brand-panel">
          <div className="brand-title">
            <Waypoints size={20} />
            <h1>Mitsurugi Graph Lab</h1>
          </div>
          <p>Árbol editable de cartas, acciones, condiciones y targets legales.</p>
        </div>

        <div className="control-panel">
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
      </aside>

      <section className="canvas-area" id="graph-panel">
        <div className="top-card">
          <div>
            <strong>{selectedCard ? selectedCard.name : "Todas las cartas"}</strong>
            <p>{selectedCard ? selectedCard.summary : "Vista completa del motor de dependencias."}</p>
          </div>
          <div className="legal-counter">
            <Swords size={16} />
            {legalActions.length} legales
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
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </section>

      <aside className="state-panel" id="state-panel">
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
      </aside>
    </main>
  );
}
