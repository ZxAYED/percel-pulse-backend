import { Server as HTTPServer } from "http";
import { Secret } from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import app from "./app";
import { AgentService } from "./app/modules/Agent/agent.service";
import config from "./config";
import { jwtHelpers } from "./helpers/jwtHelpers";

const port = 5000;


async function main() {


  const httpServer: HTTPServer = app.listen(port, () => {
    console.log("🚀 Server is running on port", port);
  });

  type AuthedWS = WebSocket & {
    user?: { id: string; email: string; role: string };
  };
  const rooms = new Map<string, Set<AuthedWS>>();
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  const broadcastParcelLocation = (
    parcelId: string,
    payload: {
      parcelId: string;
      latitude: number;
      longitude: number;
      speedKph?: number | null;
      heading?: number | null;
      recordedAt: Date;
    }
  ) => {
    const roomKey = `parcel:${parcelId}`;
    const clients = rooms.get(roomKey);
    if (!clients) return;
    const message = JSON.stringify({ type: "parcel_location", ...payload });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };
  app.set("broadcastParcelLocation", broadcastParcelLocation);

  wss.on("connection", (ws: AuthedWS, req) => {
    ws.on("message", async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      if (msg.type === "auth") {
        const token = msg.token as string;
        try {
          const verified = jwtHelpers.verifyToken(
            token,
            config.jwt.access_token_secret as Secret
          );
          ws.user = {
            id: (verified as any).id,
            email: (verified as any).email,
            role: (verified as any).role,
          };
          ws.send(JSON.stringify({ type: "auth_ok" }));
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
        }
        return;
      }

      if (!ws.user) {
        ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
        return;
      }

      if (msg.type === "join") {
        const roomKey = `parcel:${msg.parcelId}`;
        let set = rooms.get(roomKey);
        if (!set) {
          set = new Set<AuthedWS>();
          rooms.set(roomKey, set);
        }
        set.add(ws);
        ws.send(JSON.stringify({ type: "join_ok", parcelId: msg.parcelId }));
        return;
      }

      if (msg.type === "leave") {
        const roomKey = `parcel:${msg.parcelId}`;
        rooms.get(roomKey)?.delete(ws);
        ws.send(JSON.stringify({ type: "leave_ok", parcelId: msg.parcelId }));
        return;
      }

      if (msg.type === "agent_location_update") {
        try {
          const { parcelId, latitude, longitude, speedKph, heading } = msg;
          await AgentService.recordLocationUpdate({
            agentId: ws.user!.id,
            parcelId,
            latitude,
            longitude,
            speedKph,
            heading,
          });
          ws.send(JSON.stringify({ type: "ack", action: "agent_location_update", parcelId }));
        } catch (err: any) {
          ws.send(
            JSON.stringify({
              type: "error",
              action: "agent_location_update",
              parcelId: msg.parcelId,
              message: err?.message || "Failed to update location",
            })
          );
        }
        return;
      }
    });

    ws.on("close", () => {
      rooms.forEach((set) => set.delete(ws));
    });
  });
}

main().catch((err) => {
  console.error("❌ Server failed to start:", err);
  process.exit(1);
});
