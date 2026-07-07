/**
 * Singleton WebSocket client for the mobile app.
 *
 * Events received:
 *   BILLING_UPDATED      → refresh cart billing
 *   HOME_UPDATED         → force-refresh home data
 *   ORDER_STATUS_UPDATED → invalidate orders cache + show toast
 */
import { resolveApiOrigin } from "../config/api";
import { getAccessToken } from "../../services/api";

type EventHandler = (data: Record<string, unknown>) => void;

const HEARTBEAT_INTERVAL_MS = 25_000; // keep Railway proxy alive (closes idle ~60s)

class WebSocketService {
  private ws: WebSocket | null = null;
  private shouldConnect = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectDelay = 3000;
  private handlers: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
    return () => {
      const list = this.handlers.get(event) ?? [];
      this.handlers.set(event, list.filter((h) => h !== handler));
    };
  }

  async connect(): Promise<void> {
    this.shouldConnect = true;
    await this._open();
  }

  disconnect(): void {
    this.shouldConnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._stopHeartbeat();
    if (this.ws) {
      // Null handlers BEFORE closing so onclose doesn't schedule a reconnect.
      const dead = this.ws;
      this.ws = null;
      dead.onopen = null;
      dead.onmessage = null;
      dead.onerror = null;
      dead.onclose = null;
      dead.close();
    }
  }

  private _startHeartbeat(ws: WebSocket): void {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws === ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: "ping" }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async _open(): Promise<void> {
    if (!this.shouldConnect) return;

    const token = await getAccessToken();
    if (!token) return;

    const origin = resolveApiOrigin().replace(/^http/, "ws");
    const url = `${origin}/api/v1/ws?token=${encodeURIComponent(token)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this._scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectDelay = 3000;
      this._startHeartbeat(ws);
    };

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      try {
        const { event, data } = JSON.parse(e.data as string);
        (this.handlers.get(event) ?? []).forEach((h) => h(data));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      ws.close(); // triggers onclose → scheduleReconnect
    };

    ws.onclose = () => {
      if (this.ws !== ws) return; // intentional disconnect already nulled this.ws
      this.ws = null;
      this._stopHeartbeat();
      this._scheduleReconnect();
    };
  }

  private _scheduleReconnect(): void {
    if (!this.shouldConnect) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30_000);
      await this._open();
    }, this.reconnectDelay);
  }
}

export const wsService = new WebSocketService();
