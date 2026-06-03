import { Handle, NodeProps, Position } from "@xyflow/react";
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
  snapshotIndex: number;
  active?: boolean;
  deckCount: number;
  extraDeckCount: number;
  zones: {
    hand: SnapshotCard[];
    field: SnapshotCard[];
    graveyard: SnapshotCard[];
    banished: SnapshotCard[];
  };
  onSelectCard?: (cardId: string) => void;
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
  onSelect,
}: {
  card: SnapshotCard;
  variant: "image" | "chip";
  onSelect?: (cardId: string) => void;
}) {
  return (
    <button
      className={variant === "image" ? "snapshot-field-card nodrag nopan" : "snapshot-field-chip nodrag nopan"}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(card.id);
      }}
      title={card.name}
    >
      {variant === "image" && card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : card.shortName}
    </button>
  );
}

function SnapshotStack({ label, count }: { label: string; count: number }) {
  return (
    <div className="snapshot-stack">
      <div className="snapshot-card-back" />
      <strong>{label}</strong>
      <span>{count}</span>
    </div>
  );
}

export function SnapshotNode({ data }: NodeProps) {
  const typedData = data as SnapshotNodeData;
  const fieldCards = typedData.zones.field.slice(0, 5);
  const zoneList = [
    { key: "hand", label: "Hand", cards: typedData.zones.hand },
    { key: "graveyard", label: "GY", cards: typedData.zones.graveyard },
    { key: "banished", label: "Banish", cards: typedData.zones.banished },
  ];

  return (
    <div className={`snapshot-node ${typedData.active ? "snapshot-node-active" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="snapshot-node-header">
        <strong>{typedData.title}</strong>
        <span>{typedData.subtitle}</span>
      </div>

      <div className="snapshot-board-main">
        <SnapshotStack label="Deck" count={typedData.deckCount} />
        <div className="snapshot-field">
          <span>Field</span>
          <div className="snapshot-field-slots">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="snapshot-field-slot">
                {fieldCards[index] ? (
                  <SnapshotCardButton card={fieldCards[index]} variant="image" onSelect={typedData.onSelectCard} />
                ) : (
                  <span className="snapshot-empty-slot" />
                )}
              </div>
            ))}
          </div>
        </div>
        <SnapshotStack label="Extra" count={typedData.extraDeckCount} />
      </div>

      <div className="snapshot-zones">
        {zoneList.map((zone) => (
          <div key={zone.key} className="snapshot-zone">
            <span>
              {zone.label} {zone.cards.length}
            </span>
            <div>
              {zone.cards.map((card) => (
                <SnapshotCardButton key={card.id} card={card} variant="chip" onSelect={typedData.onSelectCard} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const nodeTypes = {
  card: CardNode,
  action: ActionNode,
  condition: ConditionNode,
  wildcard: WildcardNode,
  snapshot: SnapshotNode,
};
