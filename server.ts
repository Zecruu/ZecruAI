/**
 * ZecruAI Unified Server
 *
 * Runs EVERYTHING in one process:
 *   1. Next.js web app
 *   2. Socket.io relay server
 *
 * Users just run this one file (or double-click the launcher).
 */

import { createServer } from "http";
import next from "next";
import { Server, Socket } from "socket.io";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

interface RoomState {
  daemon: Socket | null;
  clients: Set<string>;
  workingDir?: string;
}

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(code: string): RoomState {
  if (!rooms.has(code)) {
    rooms.set(code, { daemon: null, clients: new Set() });
  }
  return rooms.get(code)!;
}

// Export rooms so API routes can access daemon state
(global as any).__zecruRooms = rooms;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // --- Socket.io Relay (embedded) ---
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Make io accessible to API routes
  (global as any).__zecruIO = io;

  io.on("connection", (socket) => {
    let joinedRoom: string | null = null;
    let isDaemon = false;

    // Daemon registers
    socket.on("daemon:register", (data: { pairingCode: string; workingDir?: string }) => {
      const room = getOrCreateRoom(data.pairingCode);
      room.daemon = socket;
      room.workingDir = data.workingDir;
      joinedRoom = data.pairingCode;
      isDaemon = true;

      socket.join(data.pairingCode);
      socket.to(data.pairingCode).emit("daemon:status", {
        status: "connected",
        workingDir: data.workingDir,
      });
      socket.emit("daemon:registered", { success: true });

      console.log(`  [relay] Daemon connected: room=${data.pairingCode} dir=${data.workingDir}`);
    });

    // Client joins
    socket.on("client:join", (data: { pairingCode: string }) => {
      const room = getOrCreateRoom(data.pairingCode);
      room.clients.add(socket.id);
      joinedRoom = data.pairingCode;
      isDaemon = false;

      socket.join(data.pairingCode);
      socket.emit("daemon:status", {
        status: room.daemon ? "connected" : "disconnected",
        workingDir: room.workingDir,
      });

      console.log(`  [relay] Client joined: room=${data.pairingCode} daemon=${room.daemon ? "YES" : "NO"}`);
    });

    // Client → Daemon message
    socket.on("client:message", (data: { content: string; conversationId?: string }) => {
      if (!joinedRoom) return;
      const room = rooms.get(joinedRoom);
      if (!room?.daemon) {
        socket.emit("error:no_daemon", {
          message: "Daemon not connected. Click Connect in Settings to start it.",
        });
        return;
      }
      room.daemon.emit("daemon:message", {
        content: data.content,
        conversationId: data.conversationId,
        from: socket.id,
      });
    });

    // Daemon → Client response
    socket.on("daemon:response", (data: { content: string; type?: string; done?: boolean }) => {
      if (!joinedRoom) return;
      socket.to(joinedRoom).emit("client:response", data);
    });

    // Daemon permission request
    socket.on("daemon:permission_request", (data: {
      id: string; action: string; description: string; files?: string[];
    }) => {
      if (!joinedRoom) return;
      socket.to(joinedRoom).emit("client:permission_request", data);
    });

    // Client permission response
    socket.on("client:permission_response", (data: { id: string; approved: boolean }) => {
      if (!joinedRoom) return;
      const room = rooms.get(joinedRoom);
      if (room?.daemon) {
        room.daemon.emit("daemon:permission_response", data);
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      if (joinedRoom) {
        const room = rooms.get(joinedRoom);
        if (room) {
          if (isDaemon) {
            room.daemon = null;
            socket.to(joinedRoom).emit("daemon:status", { status: "disconnected" });
            console.log(`  [relay] Daemon disconnected: room=${joinedRoom}`);
          } else {
            room.clients.delete(socket.id);
          }
          if (!room.daemon && room.clients.size === 0) {
            rooms.delete(joinedRoom);
          }
        }
      }
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`
  ┌─────────────────────────────────────┐
  │            ZecruAI v0.1             │
  │    Your AI Agent — Made Simple      │
  └─────────────────────────────────────┘

  App running at:  http://localhost:${PORT}
  Network:         http://${getLocalIP()}:${PORT}

  Open the URL above in your browser.
  On your phone, use the Network URL (same WiFi).
    `);
  });
});

function getLocalIP(): string {
  const { networkInterfaces } = require("os");
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}
