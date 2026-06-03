import { Handle, NodeProps, Position } from "@xyflow/react";

type NodeData = {
  title: string;
  subtitle?: string;
  summary?: string;
  tags?: string[];
  color?: string;
  imageUrl?: string;
  imageUrls?: string[];
  nodeKind?: "card" | "action" | "condition" | "wildcard";
  available?: boolean;
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
        ) : null}
        <div className="node-copy">
      <div className="node-header">
        <div className="node-title">{data.title}</div>
        <span className={`node-status ${isAvailable ? "status-live" : "status-idle"}`}>
          {isAvailable ? "legal" : "idle"}
        </span>
      </div>
      {data.summary ? <p className="node-summary">{data.summary}</p> : null}
      {data.imageUrls?.length ? (
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

export const nodeTypes = {
  card: CardNode,
  action: ActionNode,
  condition: ConditionNode,
  wildcard: WildcardNode,
};
