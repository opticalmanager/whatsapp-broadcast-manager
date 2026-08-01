import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger, UseGuards } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";

@WebSocketGateway({
  namespace: "/ws/whatsapp",
  cors: {
    origin: [
      "https://broadcasting.opticalmanager.in",
      "https://www.opticalmanager.in",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
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
        this.logger.warn(`Rejected unauthenticated socket connection: ${client.id}`);
        client.disconnect();
        return;
      }

      const session = this.authService.validateSsoToken(token);
      client.data.session = session;

      const roomName = `org:${session.organizationId}`;
      client.join(roomName);

      this.logger.log(`Socket client ${client.id} joined room ${roomName} for Store Owner ${session.email}`);
    } catch (err: any) {
      this.logger.warn(`Socket authentication failed for ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket client disconnected: ${client.id}`);
  }

  /**
   * Emits live QR Code Base64 payload to Store Owner's socket room.
   */
  emitQrCode(orgId: string, shopId: string, payload: { numberId: string; qrBase64: string; status: string }) {
    const roomName = `org:${orgId}`;
    this.server.to(roomName).emit("qr_code", payload);
  }

  /**
   * Emits session connected celebration event to Store Owner's socket room.
   */
  emitSessionConnected(
    orgId: string,
    shopId: string,
    payload: { numberId: string; phoneNumber: string; displayName: string; status: string }
  ) {
    const roomName = `org:${orgId}`;
    this.server.to(roomName).emit("session_connected", payload);
  }

  /**
   * Emits connection status updates (RECONNECTING, LOGGED_OUT, DISCONNECTED).
   */
  emitStatusChanged(
    orgId: string,
    shopId: string,
    payload: { numberId: string; status: string; reason?: string }
  ) {
    const roomName = `org:${orgId}`;
    this.server.to(roomName).emit("status_changed", payload);
  }
}
