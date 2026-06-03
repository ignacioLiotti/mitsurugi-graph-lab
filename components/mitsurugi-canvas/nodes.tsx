import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  Handle,
  NodeProps,
  Position,
} from "@xyflow/react";
import { useMemo, useState } from "react";

type TargetOption = {
  id: string;
  name: string;
  subtitle?: string;
  summary: string;
  imageUrl?: string;
};

type NodeData = {
  title: string;
  subtitle?: string;
  summary?: string;
  tags?: string[];
  color?: string;
  imageUrl?: string;
  imageUrls?: string[];
  targetOptions?: TargetOption[];
  nodeKind?: "card" | "action" | "condition" | "wildcard";
  available?: boolean;
};

type SnapshotCard = {
  id: string;
  name: string;
  shortName: string;
  imageUrl?: string;
};

type SnapshotNodeData = {
  title: string;
  subtitle?: string;
  description?: string;
  effectName?: string;
  effectNumber?: number;
  materials?: string[];
  snapshotIndex: number;
  active?: boolean;
  deckCount: number;
  extraDeckCount: number;
  zones: {
    hand: SnapshotCard[];
    field: SnapshotCard[];
    graveyard: SnapshotCard[];
    banished: SnapshotCard[];
    deck: SnapshotCard[];
    extraDeck: SnapshotCard[];
  };
  highlightedCardIds?: string[];
  highlightedZones?: string[];
  onSelectCard?: (cardId: string) => void;
  onInspectZone?: (zone: "hand" | "field" | "graveyard" | "banished" | "deck" | "extraDeck") => void;
};

function BaseNode({
  data,
  borderColor,
  background,
}: {
  data: NodeData;
  borderColor: string;
  background: string;
}) {
  const isAvailable = data.available ?? false;
  const nodeKind = data.nodeKind ?? "wildcard";
  const [selectedTargetId, setSelectedTargetId] = useState(data.targetOptions?.[0]?.id ?? "");
  const selectedTarget = useMemo(() => {
    return data.targetOptions?.find((target) => target.id === selectedTargetId) ?? data.targetOptions?.[0];
  }, [data.targetOptions, selectedTargetId]);
  const typeLabel =
    nodeKind === "card"
      ? "Card"
      : nodeKind === "action"
        ? "Action"
        : nodeKind === "condition"
          ? "Condition"
          : "Target";

  return (
    <div
      className={`graph-node graph-node-${nodeKind} ${isAvailable ? "graph-node-active" : "graph-node-muted"}`}
      style={{ borderColor, background }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-type-band">
        <span>{typeLabel}</span>
        {data.subtitle ? <strong>{data.subtitle}</strong> : null}
      </div>
      <div className="node-content-grid">
        {data.imageUrl ? (
          <img className="node-card-image" src={data.imageUrl} alt={data.title} />
        ) : selectedTarget?.imageUrl ? (
          <img className="node-card-image wildcard-selected-image" src={selectedTarget.imageUrl} alt={selectedTarget.name} />
        ) : null}
        <div className="node-copy">
          <div className="node-header">
            <div className="node-title">{data.title}</div>
            <span className={`node-status ${isAvailable ? "status-live" : "status-idle"}`}>
              {isAvailable ? "legal" : "idle"}
            </span>
          </div>
          {data.summary ? <p className="node-summary">{data.summary}</p> : null}
          {data.targetOptions?.length ? (
            <div className="wildcard-picker nodrag nopan">
              <label>Opciones del flujo</label>
              <select
                value={selectedTarget?.id ?? ""}
                onChange={(event) => setSelectedTargetId(event.target.value)}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                {data.targetOptions.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
              {selectedTarget ? (
                <div className="wildcard-selected-card">
                  <strong>{selectedTarget.name}</strong>
                  {selectedTarget.subtitle ? <span>{selectedTarget.subtitle}</span> : null}
                  <p>{selectedTarget.summary}</p>
                </div>
              ) : null}
            </div>
          ) : data.imageUrls?.length ? (
            <div className="node-image-strip" aria-label="Cartas relacionadas">
              {data.imageUrls.map((imageUrl) => (
                <img key={imageUrl} src={imageUrl} alt="" />
              ))}
            </div>
          ) : null}
          {data.tags?.length ? (
            <div className="node-tags">
              {data.tags.map((tag) => (
                <span key={tag} className="node-tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function CardNode({ data }: NodeProps) {
  return <BaseNode data={data as NodeData} borderColor="#2563eb" background="#ffffff" />;
}

export function ActionNode({ data }: NodeProps) {
  const typedData = data as NodeData;
  return <BaseNode data={typedData} borderColor={typedData.color ?? "#64748b"} background="#f8fafc" />;
}

export function ConditionNode({ data }: NodeProps) {
  return <BaseNode data={data as NodeData} borderColor="#f59e0b" background="#fffbeb" />;
}

export function WildcardNode({ data }: NodeProps) {
  return <BaseNode data={data as NodeData} borderColor="#64748b" background="#f1f5f9" />;
}

function SnapshotCardButton({
  card,
  variant,
  highlighted,
  onSelect,
}: {
  card: SnapshotCard;
  variant: "image" | "chip";
  highlighted?: boolean;
  onSelect?: (cardId: string) => void;
}) {
  function selectCard() {
    onSelect?.(card.id);
    window.dispatchEvent(
      new CustomEvent("mitsurugi:snapshot-card", {
        detail: { cardId: card.id },
      }),
    );
  }

  return (
    <button
      type="button"
      className={`${variant === "image" ? "snapshot-field-card" : "snapshot-field-chip"} ${
        highlighted ? "snapshot-card-highlight" : ""
      } nodrag nopan`}
      data-card-id={card.id}
      onPointerDown={(event) => {
        event.stopPropagation();
        selectCard();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => {
        event.stopPropagation();
        selectCard();
      }}
      onFocus={() => selectCard()}
      onClick={(event) => {
        event.stopPropagation();
        selectCard();
      }}
      title={card.name}
    >
      {variant === "image" && card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : card.shortName}
    </button>
  );
}

function SnapshotStack({
  label,
  count,
  zone,
  highlighted,
  onClick,
}: {
  label: string;
  count: number;
  zone?: "hand" | "field" | "graveyard" | "banished" | "deck" | "extraDeck";
  highlighted?: boolean;
  onClick?: () => void;
}) {
  function inspectZone() {
    onClick?.();
    if (!zone) return;
    window.dispatchEvent(
      new CustomEvent("mitsurugi:snapshot-zone", {
        detail: { zone },
      }),
    );
  }

  return (
    <button
      type="button"
      className={`snapshot-stack ${highlighted ? "snapshot-stack-highlight" : ""} nodrag nopan`}
      data-zone={zone}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        inspectZone();
      }}
    >
      <div className="snapshot-card-back" />
      <strong>{label}</strong>
      <span>{count}</span>
    </button>
  );
}

export function SnapshotNode({ data }: NodeProps) {
  const typedData = data as SnapshotNodeData;
  const fieldCards = typedData.zones.field.slice(0, 10);
  const highlightedCards = new Set(typedData.highlightedCardIds ?? []);
  const highlightedZones = new Set(typedData.highlightedZones ?? []);

  return (
    <div className={`snapshot-node ${typedData.active ? "snapshot-node-active" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="snapshot-node-header">
        <strong>{typedData.title}</strong>
        <span>{typedData.subtitle}</span>
      </div>
      {(typedData.effectName || typedData.description || typedData.materials?.length) && (
        <div className="snapshot-step-detail">
          {typedData.effectName ? (
            <strong>
              {typeof typedData.effectNumber === "number" ? `E${typedData.effectNumber}: ` : ""}
              {typedData.effectName}
            </strong>
          ) : null}
          {typedData.description ? <p>{typedData.description}</p> : null}
          {typedData.materials?.length ? <span>Materials: {typedData.materials.join(", ")}</span> : null}
        </div>
      )}

      <div className="snapshot-board-main">
        <div className="snapshot-side-stack">
          <SnapshotStack
            label="Extra"
            count={typedData.extraDeckCount}
            zone="extraDeck"
            highlighted={highlightedZones.has("extraDeck")}
            onClick={() => typedData.onInspectZone?.("extraDeck")}
          />
          <SnapshotStack
            label="Field"
            count={0}
            zone="field"
            highlighted={highlightedZones.has("field")}
            onClick={() => typedData.onInspectZone?.("field")}
          />
        </div>

        <div className="snapshot-field">
          <span>Field</span>
          <div className="snapshot-field-slots">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="snapshot-field-slot">
                {fieldCards[index] ? (
                  <SnapshotCardButton
                    card={fieldCards[index]}
                    variant="image"
                    highlighted={highlightedCards.has(fieldCards[index].id) || highlightedZones.has("field")}
                    onSelect={typedData.onSelectCard}
                  />
                ) : (
                  <span className={highlightedZones.has("field") ? "snapshot-empty-slot snapshot-slot-highlight" : "snapshot-empty-slot"} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="snapshot-side-stack">
          <SnapshotStack
            label="Deck"
            count={typedData.deckCount}
            zone="deck"
            highlighted={highlightedZones.has("deck")}
            onClick={() => typedData.onInspectZone?.("deck")}
          />
          <SnapshotStack
            label="GY"
            count={typedData.zones.graveyard.length}
            zone="graveyard"
            highlighted={highlightedZones.has("graveyard")}
            onClick={() => typedData.onInspectZone?.("graveyard")}
          />
          <SnapshotStack
            label="Banish"
            count={typedData.zones.banished.length}
            zone="banished"
            highlighted={highlightedZones.has("banished")}
            onClick={() => typedData.onInspectZone?.("banished")}
          />
        </div>
      </div>

      <div className="snapshot-zones">
        <div className="snapshot-zone snapshot-hand-zone">
          <span>Hand {typedData.zones.hand.length}</span>
          <div>
            {typedData.zones.hand.map((card) => (
              <SnapshotCardButton
                key={card.id}
                card={card}
                variant="image"
                highlighted={highlightedCards.has(card.id) || highlightedZones.has("hand")}
                onSelect={typedData.onSelectCard}
              />
            ))}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function SnapshotRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const label = typeof data?.label === "string" ? data.label : "";

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} className="snapshot-relation-path" />
      <EdgeLabelRenderer>
        <div
          className="snapshot-relation-label nodrag nopan"
          style={{
            transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 18}px)`,
          }}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const nodeTypes = {
  card: CardNode,
  action: ActionNode,
  condition: ConditionNode,
  wildcard: WildcardNode,
  snapshot: SnapshotNode,
};

export const edgeTypes = {
  snapshotRelation: SnapshotRelationEdge,
};
