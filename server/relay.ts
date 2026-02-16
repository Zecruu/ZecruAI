/**
 * ZecruAI Relay Server
 *
 * This server sits between the web app (phone/browser) and the local daemon
 * (user's computer). It routes messages using pairing codes as room IDs.
 *
 * Web App <--WebSocket--> Relay Server <--WebSocket--> Local Daemon
 */

import { createServer } from "http";
import { Server, Socket } from "socket.io";

const PORT = parseInt(process.env.RELAY_PORT || "3001", 10);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: io.sockets.adapter.rooms.size }));
    return;
  }
  res.writeHead(200);
  res.end("ZecruAI Relay Server");
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

interface RoomState {
  daemon: Socket | null;
  clients: Set<string>;
}

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(code: string): RoomState {
  if (!rooms.has(code)) {
    rooms.set(code, { daemon: null, clients: new Set() });
  }
  return rooms.get(code)!;
}

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  let joinedRoom: string | null = null;
  let isDaemon = false;

  // Daemon registers with a pairing code
  socket.on("daemon:register", (data: { pairingCode: string; workingDir?: string }) => {
    const { pairingCode, workingDir } = data;
    const room = getOrCreateRoom(pairingCode);

    room.daemon = socket;
    joinedRoom = pairingCode;
    isDaemon = true;

    socket.join(pairingCode);
    console.log(`[daemon:register] Daemon joined room ${pairingCode}`);

    // Notify all clients in this room that daemon is online
    socket.to(pairingCode).emit("daemon:status", {
      status: "connected",
      workingDir,
    });

    socket.emit("daemon:registered", { success: true });
  });

  // Client (web app) joins with a pairing code
  socket.on("client:join", (data: { pairingCode: string }) => {
    const { pairingCode } = data;
    const room = getOrCreateRoom(pairingCode);

    room.clients.add(socket.id);
    joinedRoom = pairingCode;
    isDaemon = false;

    socket.join(pairingCode);
    console.log(`[client:join] Client joined room ${pairingCode}`);

    // Tell client if daemon is already connected
    socket.emit("daemon:status", {
      status: room.daemon ? "connected" : "disconnected",
    });
  });

  // Client sends a message to Claude Code (through daemon)
  socket.on("client:message", (data: { content: string; conversationId?: string }) => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room?.daemon) {
      socket.emit("error:no_daemon", {
        message: "No daemon connected. Make sure your computer is running the ZecruAI daemon.",
      });
      return;
    }

    // Forward to daemon
    room.daemon.emit("daemon:message", {
      content: data.content,
      conversationId: data.conversationId,
      from: socket.id,
    });
  });

  // Daemon streams response back to clients
  socket.on("daemon:response", (data: { content: string; type?: string; done?: boolean }) => {
    if (!joinedRoom) return;
    socket.to(joinedRoom).emit("client:response", data);
  });

  // Daemon sends live activity updates (tool use, progress, status)
  socket.on("daemon:activity", (data: { type: string; tool?: string; message: string; input?: unknown }) => {
    if (!joinedRoom) return;
    socket.to(joinedRoom).emit("client:activity", data);
  });

  // Daemon sends final result with cost/duration info
  socket.on("daemon:result", (data: {
    text: string;
    isError: boolean;
    costUsd: number;
    durationMs: number;
    sessionId: string | null;
  }) => {
    if (!joinedRoom) return;
    socket.to(joinedRoom).emit("client:result", data);
  });

  // Daemon sends a permission request
  socket.on("daemon:permission_request", (data: {
    id: string;
    action: string;
    description: string;
    files?: string[];
  }) => {
    if (!joinedRoom) return;
    socket.to(joinedRoom).emit("client:permission_request", data);
  });

  // Client responds to a permission request
  socket.on("client:permission_response", (data: { id: string; approved: boolean }) => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (room?.daemon) {
      room.daemon.emit("daemon:permission_response", data);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);

    if (joinedRoom) {
      const room = rooms.get(joinedRoom);
      if (room) {
        if (isDaemon) {
          room.daemon = null;
          // Notify clients daemon went offline
          socket.to(joinedRoom).emit("daemon:status", { status: "disconnected" });
        } else {
          room.clients.delete(socket.id);
        }

        // Clean up empty rooms
        if (!room.daemon && room.clients.size === 0) {
          rooms.delete(joinedRoom);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  ZecruAI Relay Server running on port ${PORT}\n`);
});
