import React, { useEffect, useRef, useState } from "react";
import { Text } from "@stellar/design-system";

export interface StreamData {
  id: string;
  employeeName: string;
  employeeAddress: string;
  flowRate: string;
  tokenSymbol: string;
}

interface StreamVisualizerProps {
  streams: StreamData[];
  treasuryBalance: string;
}

interface Node {
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  type: "treasury" | "stream";
  data?: StreamData;
}

interface Particle {
  id: number;
  sourceId: string;
  targetId: string;
  progress: number;
  speed: number;
  color: string;
}

interface CustomCanvas extends HTMLCanvasElement {
  _mousePos?: { x: number; y: number } | null;
}

const StreamVisualizer: React.FC<StreamVisualizerProps> = ({
  streams,
  treasuryBalance,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Pan and Zoom State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let particleIdCounter = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      if (
        canvas.width !== rect.width * dpr ||
        canvas.height !== rect.height * dpr
      ) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Apply Pan and Zoom
      const { x: tx, y: ty, scale } = transformRef.current;
      ctx.translate(rect.width / 2 + tx, rect.height / 2 + ty);
      ctx.scale(scale, scale);

      const centerX = 0;
      const centerY = 0;
      const streamRadius = 200;
      const workerRadius = 350;

      const nodes: Node[] = [];

      // Treasury Node
      nodes.push({
        id: "treasury",
        x: centerX,
        y: centerY,
        radius: 45,
        label: `Treasury`,
        type: "treasury",
      });

      // Stream & Worker Nodes
      const numStreams = streams.length;
      streams.forEach((stream, i) => {
        const angle = (i * 2 * Math.PI) / numStreams - Math.PI / 2;

        // Stream Node
        const sx = centerX + streamRadius * Math.cos(angle);
        const sy = centerY + streamRadius * Math.sin(angle);
        const streamNode: Node = {
          id: `stream-${stream.id}`,
          x: sx,
          y: sy,
          radius: 20,
          label: `Stream ${stream.id}`,
          type: "stream",
          data: stream,
        };
        nodes.push(streamNode);

        // Worker Node
        const wx = centerX + workerRadius * Math.cos(angle);
        const wy = centerY + workerRadius * Math.sin(angle);
        nodes.push({
          id: `worker-${stream.id}`,
          x: wx,
          y: wy,
          radius: 15,
          label: stream.employeeName,
          type: "stream", // Reuse type for simplicity or add 'worker'
          data: stream,
        });

        // Spawn particles
        if (Math.random() < 0.1 && numStreams > 0) {
          particles.push({
            id: particleIdCounter++,
            sourceId: "treasury",
            targetId: streamNode.id,
            progress: 0,
            speed: 0.004 + Math.random() * 0.006,
            color: "rgba(59, 130, 246, 0.6)",
          });
          particles.push({
            id: particleIdCounter++,
            sourceId: streamNode.id,
            targetId: `worker-${stream.id}`,
            progress: 0,
            speed: 0.008 + Math.random() * 0.01,
            color: "rgba(16, 185, 129, 0.6)", // emerald-500
          });
        }
      });

      // Draw Edges
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";

      streams.forEach((stream) => {
        const angle =
          (streams.indexOf(stream) * 2 * Math.PI) / numStreams - Math.PI / 2;
        const sx = centerX + streamRadius * Math.cos(angle);
        const sy = centerY + streamRadius * Math.sin(angle);
        const wx = centerX + workerRadius * Math.cos(angle);
        const wy = centerY + workerRadius * Math.sin(angle);

        // Treasury to Stream
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        // Stream to Worker
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(wx, wy);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Update & Draw Particles
      particles.forEach((p) => {
        p.progress += p.speed;
      });
      particles = particles.filter((p) => p.progress < 1);

      particles.forEach((p) => {
        const source = nodes.find((n) => n.id === p.sourceId);
        const target = nodes.find((n) => n.id === p.targetId);
        if (!source || !target) return;

        const x = source.x + (target.x - source.x) * p.progress;
        const y = source.y + (target.y - source.y) * p.progress;

        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw Nodes
      nodes.forEach((node) => {
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + (isHovered ? 2 : 0), 0, 2 * Math.PI);

        if (node.type === "treasury") {
          const grad = ctx.createRadialGradient(
            node.x,
            node.y,
            0,
            node.x,
            node.y,
            node.radius,
          );
          grad.addColorStop(0, "#1e293b");
          grad.addColorStop(1, "#0f172a");
          ctx.fillStyle = grad;
        } else if (node.id.startsWith("worker-")) {
          ctx.fillStyle = "#10b981";
        } else {
          ctx.fillStyle = "#3b82f6";
        }

        ctx.fill();
        ctx.strokeStyle = isSelected
          ? "#fbbf24"
          : isHovered
            ? "#fff"
            : "rgba(255,255,255,0.2)";
        ctx.lineWidth = isSelected || isHovered ? 3 : 1;
        ctx.stroke();

        // Text
        if (scale > 0.6) {
          ctx.fillStyle = "var(--sds-color-content-primary, #000)";
          ctx.font = `${isHovered ? "bold " : ""}10px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(node.label, node.x, node.y + node.radius + 15);
        }
      });

      ctx.restore();

      // Mouse position in world coordinates
      if (canvasRef.current && (canvasRef.current as CustomCanvas)._mousePos) {
        const m = (canvasRef.current as CustomCanvas)._mousePos!;
        const worldX = (m.x - rect.width / 2 - tx) / scale;
        const worldY = (m.y - rect.height / 2 - ty) / scale;

        let found: Node | null = null;
        for (const node of nodes) {
          const dx = worldX - node.x;
          const dy = worldY - node.y;
          if (Math.sqrt(dx * dx + dy * dy) <= node.radius / scale + 5) {
            found = node;
            break;
          }
        }
        setHoveredNode(found);
        if (found) {
          canvas.style.cursor = "pointer";
          setTooltipPos({ x: m.x, y: m.y });
        } else {
          canvas.style.cursor = isDragging.current ? "grabbing" : "default";
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [streams, treasuryBalance, hoveredNode, selectedNode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
    } else {
      setSelectedNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (canvasRef.current as CustomCanvas)._mousePos = mousePos;

    if (isDragging.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      transformRef.current = {
        ...transformRef.current,
        x: transformRef.current.x + dx,
        y: transformRef.current.y + dy,
      };
      setTransform({ ...transformRef.current });
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSpeed = 0.001;
    const newScale = Math.min(Math.max(transformRef.current.scale - e.deltaY * zoomSpeed, 0.2), 3);
    transformRef.current = { ...transformRef.current, scale: newScale };
    setTransform({ ...transformRef.current });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "500px",
        background: "var(--sds-color-neutral-background-subtle, #f8fafc)",
        borderRadius: "16px",
        border: "1px solid var(--sds-color-neutral-border, #e2e8f0)",
        overflow: "hidden",
        boxShadow: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Controls Overlay */}
      <div style={{ position: "absolute", bottom: "16px", right: "16px", display: "flex", gap: "8px" }}>
        <Button variant="secondary" size="xs" onClick={() => {
          transformRef.current = { x: 0, y: 0, scale: 1 };
          setTransform({ ...transformRef.current });
        }}>Reset View</Button>
      </div>

      {hoveredNode && (
        <div
          style={{
            position: "absolute",
            left: tooltipPos.x + 20,
            top: tooltipPos.y + 20,
            background: "rgba(15, 23, 42, 0.9)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            zIndex: 100,
            pointerEvents: "none",
            color: "white",
            minWidth: "220px",
          }}
        >
          <Text as="div" size="sm" weight="bold" style={{ color: "#fff", marginBottom: "4px" }}>
            {hoveredNode.type === "treasury" ? "Treasury Vault" : hoveredNode.label}
          </Text>
          <Text as="div" size="xs" style={{ color: "#94a3b8", opacity: 0.8, marginBottom: "8px" }}>
             {hoveredNode.type === "treasury" ? "Central Liquidity Pool" : hoveredNode.data?.employeeAddress}
          </Text>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px" }}>
            {hoveredNode.type === "treasury" ? (
              <Text as="div" size="sm" style={{ color: "#34d399" }}>Balance: {treasuryBalance}</Text>
            ) : (
              <>
                <Text as="div" size="xs" style={{ color: "#94a3b8" }}>Flow Rate: {hoveredNode.data?.flowRate} {hoveredNode.data?.tokenSymbol}/sec</Text>
                <Text as="div" size="xs" style={{ color: "#94a3b8" }}>Status: Active</Text>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ position: "absolute", top: "16px", left: "16px", background: "rgba(255,255,255,0.8)", padding: "8px 12px", borderRadius: "8px", fontSize: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1e293b" }} /> Treasury</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} /> Active Stream</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} /> Destination Worker</div>
      </div>
    </div>
  );
};

export default StreamVisualizer;
