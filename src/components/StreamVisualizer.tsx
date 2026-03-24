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

const StreamVisualizer: React.FC<StreamVisualizerProps> = ({ streams, treasuryBalance }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let particleIdCounter = 0;

    const render = () => {
      // Setup High-DPI Canvas
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      } else {
        // We still need to scale on every frame if we clear the transform? 
        // Better to just track width/height explicitly.
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.35;

      const nodes: Node[] = [];
      
      // Treasury Node
      nodes.push({
        id: "treasury",
        x: centerX,
        y: centerY,
        radius: 40,
        label: `Treasury (${treasuryBalance})`,
        type: "treasury"
      });

      // Stream Nodes
      const numStreams = streams.length;
      streams.forEach((stream, i) => {
        const angle = (i * 2 * Math.PI) / numStreams - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        nodes.push({
          id: stream.id,
          x,
          y,
          radius: 20,
          label: stream.employeeName,
          type: "stream",
          data: stream
        });
      });

      // Spawn new particles
      if (Math.random() < 0.2 * numStreams && numStreams > 0) {
        const randomStream = streams[Math.floor(Math.random() * numStreams)];
        particles.push({
          id: particleIdCounter++,
          sourceId: "treasury",
          targetId: randomStream.id,
          progress: 0,
          speed: 0.005 + Math.random() * 0.005,
          color: "rgba(59, 130, 246, 0.8)" // blue-500 equivalent
        });
      }

      // Draw Edges
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(100, 100, 100, 0.2)";
      nodes.forEach(node => {
        if (node.type === "stream") {
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(node.x, node.y);
          ctx.stroke();
        }
      });

      // Update & Draw Particles
      particles.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 1;
      });
      particles = particles.filter(p => p.progress < 1);

      particles.forEach(p => {
        const targetNode = nodes.find(n => n.id === p.targetId);
        if (!targetNode) return;
        
        const x = centerX + (targetNode.x - centerX) * p.progress;
        const y = centerY + (targetNode.y - centerY) * p.progress;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw Nodes
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        
        if (node.type === "treasury") {
          ctx.fillStyle = "#1e293b"; // slate-800
          ctx.fill();
          ctx.strokeStyle = "#94a3b8"; // slate-400
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = "#3b82f6"; // blue-500
          ctx.fill();
          ctx.strokeStyle = "#bfdbfe"; // blue-200
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw Node Label if it's Treasury or if there are few streams
        if (node.type === "treasury" || numStreams <= 15) {
          ctx.fillStyle = "var(--sds-color-content-primary, #000)";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const labelY = node.y + node.radius + 15;
          ctx.fillText(node.label, node.x, labelY);
        }
      });

      // Handle hover interactions (just an effect, real tooltip is DOM based)
      if (canvasRef.current && (canvasRef.current as any)._mousePos) {
        const { x: mouseX, y: mouseY } = (canvasRef.current as any)._mousePos;
        let foundHover: Node | null = null;
        for (const node of nodes) {
          const dx = mouseX - node.x;
          const dy = mouseY - node.y;
          if (Math.sqrt(dx * dx + dy * dy) <= node.radius) {
            foundHover = node;
            break;
          }
        }
        
        if (foundHover) {
          canvas.style.cursor = "pointer";
          setHoveredNode(foundHover);
          setTooltipPos({ x: mouseX, y: mouseY });
          
          // Draw hover highlight
          ctx.beginPath();
          ctx.arc(foundHover.x, foundHover.y, foundHover.radius + 4, 0, 2 * Math.PI);
          ctx.strokeStyle = "#fbbf24"; // amber-400
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          canvas.style.cursor = "default";
          setHoveredNode(null);
        }
      } else {
        setHoveredNode(null);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [streams, treasuryBalance]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    (canvasRef.current as any)._mousePos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseLeave = () => {
    if (canvasRef.current) {
      (canvasRef.current as any)._mousePos = null;
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "400px", background: "var(--sds-color-neutral-background, #fff)", borderRadius: "12px", border: "1px solid var(--sds-color-neutral-border, #eaeaea)", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {hoveredNode && hoveredNode.type === "stream" && hoveredNode.data && (
        <div style={{
          position: "absolute",
          left: tooltipPos.x + 15,
          top: tooltipPos.y + 15,
          background: "var(--sds-color-neutral-background, #fff)",
          border: "1px solid var(--sds-color-neutral-border, #eaeaea)",
          padding: "12px",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          zIndex: 10,
          pointerEvents: "none",
          minWidth: "200px"
        }}>
          <Text as="div" size="sm" weight="bold" style={{ marginBottom: "4px" }}>{hoveredNode.data.employeeName}</Text>
          <Text as="div" size="xs" style={{ color: "var(--sds-color-content-secondary, #666)" }}>{hoveredNode.data.employeeAddress}</Text>
          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--sds-color-neutral-border, #eaeaea)" }}>
            <Text as="div" size="sm">Flow Rate: {hoveredNode.data.flowRate} {hoveredNode.data.tokenSymbol}/sec</Text>
          </div>
        </div>
      )}
      {hoveredNode && hoveredNode.type === "treasury" && (
        <div style={{
          position: "absolute",
          left: tooltipPos.x + 15,
          top: tooltipPos.y + 15,
          background: "var(--sds-color-neutral-background, #fff)",
          border: "1px solid var(--sds-color-neutral-border, #eaeaea)",
          padding: "12px",
          borderRadius: "8px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          zIndex: 10,
          pointerEvents: "none"
        }}>
          <Text as="div" size="sm" weight="bold">Treasury Vault</Text>
          <Text as="div" size="xs" style={{ color: "var(--sds-color-content-secondary, #666)" }}>Total Balance: {treasuryBalance}</Text>
        </div>
      )}
    </div>
  );
};

export default StreamVisualizer;
