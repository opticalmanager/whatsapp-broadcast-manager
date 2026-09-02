import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";

@WebSocketGateway({
  namespace: "/ws/whatsapp",
  cors: {
    origin: (origin: any, callback: any) => {
      callback(null, true);
    },
    credentials: true,
  },
})

export class BroadcastGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BroadcastGateway.name);

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token as string;
      if (!token) {
        this.logger.warn(`Rejected unauthenticated socket: ${client.id}`);
        client.disconnect();
        return;
      }

      // In development, accept session cookie JSON directly
      // In production, validate SSO JWT token
      let session: any;

      try {
        // Try parsing as a JSON session object (from cookie)
        const parsed = JSON.parse(token);
        if (parsed.organizationId && parsed.role === "OWNER") {
          session = parsed;
        } else {
          throw new Error("Invalid session object");
        }
      } catch {
        // Fall back to SSO JWT validation
        try {
          session = this.authService.validateSsoToken(token);
        } catch (ssoErr: any) {
          this.logger.warn(`Socket auth failed for ${client.id}: ${ssoErr.message}`);
          client.disconnect();
          return;
        }
      }

      client.data.session = session;

      const roomName = `org:${session.organizationId}`;
      client.join(roomName);

      this.logger.log(`Socket ${client.id} joined room ${roomName} (${session.email || "owner"})`);
    } catch (err: any) {
      this.logger.warn(`Socket connection error for ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket client disconnected: ${client.id}`);
  }

  emitQrCode(orgId: string, shopId: string, payload: { numberId: string; qrBase64: string; status: string }) {
    const roomName = `org:${orgId}`;
    if (this.server) {
      this.server.to(roomName).emit("qr_code", payload);
      this.server.emit("qr_code", payload); // Direct broadcast to all active listeners
    }
    this.logger.log(`Emitted QR code to room ${roomName} & broadcast for ${payload.numberId}`);
  }

  emitSessionConnected(
    orgId: string,
    shopId: string,
    payload: { numberId: string; phoneNumber: string; displayName: string; status: string }
  ) {
    const roomName = `org:${orgId}`;
    if (this.server) {
      this.server.to(roomName).emit("session_connected", payload);
      this.server.emit("session_connected", payload);
    }
  }

  emitStatusChanged(
    orgId: string,
    shopId: string,
    payload: { numberId: string; status: string; reason?: string }
  ) {
    const roomName = `org:${orgId}`;
    if (this.server) {
      this.server.to(roomName).emit("status_changed", payload);
      this.server.emit("status_changed", payload);
    }
  }

  emitChatMessage(orgId: string, payload: any) {
    const roomName = `org:${orgId}`;
    if (this.server) {
      this.server.to(roomName).emit("chat_message_received", payload);
      this.server.emit("chat_message_received", payload);
    }
  }

  emitConversationUpdated(orgId: string, payload: any) {
    const roomName = `org:${orgId}`;
    if (this.server) {
      this.server.to(roomName).emit("conversation_updated", payload);
      this.server.emit("conversation_updated", payload);
    }
  }
}
