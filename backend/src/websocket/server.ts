import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { serviceLogger } from "../audit/serviceLogger";

const JWT_SECRET =
  process.env.JWT_SECRET || "dev-secret-key-change-in-production";

export interface WebSocketAuthPayload {
  userId: string;
  role: string;
  employerId?: string;
  workerAddress?: string;
}

export type StreamEventType =
  | "stream_created"
  | "stream_funded"
  | "withdrawal"
  | "stream_cancelled"
  | "stream_completed";

export interface StreamEvent {
  type: StreamEventType;
  streamId: string;
  data: any;
  timestamp: string;
}

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server with JWT authentication
 */
export const initWebSocketServer = (httpServer: HTTPServer): SocketIOServer => {
  if (io) {
    console.log("[WebSocket] Server already initialized");
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
  });

  // Middleware for authentication
  io.use((socket: Socket & { data?: any }, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as WebSocketAuthPayload;
      socket.data = { user: decoded };
      next();
    } catch (error: any) {
      next(new Error("Invalid token"));
    }
  });

  // Connection handling
  io.on("connection", (socket: Socket & { data: any }) => {
    const user = socket.data.user as WebSocketAuthPayload;
    console.log(`[WebSocket] User connected: ${user.userId}`);

    // Join rooms based on user roles
    if (user.employerId) {
      socket.join(`employer:${user.employerId}`);
      console.log(`[WebSocket] Joined employer room: ${user.employerId}`);
    }

    if (user.workerAddress) {
      socket.join(`worker:${user.workerAddress}`);
      console.log(`[WebSocket] Joined worker room: ${user.workerAddress}`);
    }

    // Handle subscription to specific streams
    socket.on("subscribe:stream", (streamId: string) => {
      socket.join(`stream:${streamId}`);
      console.log(`[WebSocket] Subscribed to stream: ${streamId}`);
    });

    socket.on("unsubscribe:stream", (streamId: string) => {
      socket.leave(`stream:${streamId}`);
      console.log(`[WebSocket] Unsubscribed from stream: ${streamId}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`[WebSocket] User disconnected: ${user.userId}`);
    });
  });

  // Error handling
  io.on("connect_error", (error: any) => {
    console.error("[WebSocket] Connection error:", error.message);
  });

  console.log("[WebSocket] Server initialized");
  return io;
};

/**
 * Emit a stream event to relevant rooms
 */
export const emitStreamEvent = (
  eventType: StreamEventType,
  streamId: string,
  data: any,
  employerId?: string,
  workerAddress?: string,
): void => {
  if (!io) {
    console.warn("[WebSocket] Server not initialized, cannot emit event");
    return;
  }

  const event: StreamEvent = {
    type: eventType,
    streamId,
    data,
    timestamp: new Date().toISOString(),
  };

  // Emit to stream-specific room
  io.to(`stream:${streamId}`).emit("stream:event", event);

  // Emit to employer room
  if (employerId) {
    io.to(`employer:${employerId}`).emit("stream:event", event);
  }

  // Emit to worker room
  if (workerAddress) {
    io.to(`worker:${workerAddress}`).emit("stream:event", event);
  }

  // Also emit to all admins
  io.to("admin").emit("stream:event", event);

  console.log(`[WebSocket] Emitted event ${eventType} for stream ${streamId}`);
};

/**
 * Get the Socket.IO instance
 */
export const getWebSocketServer = (): SocketIOServer | null => {
  return io;
};

/**
 * Shutdown WebSocket server gracefully
 */
export const shutdownWebSocketServer = async (): Promise<void> => {
  if (io) {
    await io.close();
    io = null;
    console.log("[WebSocket] Server shut down");
  }
};
