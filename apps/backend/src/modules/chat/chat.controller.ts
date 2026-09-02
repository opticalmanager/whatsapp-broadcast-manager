import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
} from "@nestjs/common";
import { ChatService } from "./chat.service";
import { AuthService } from "../auth/auth.service";

@Controller("chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService
  ) {}

  private extractSession(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { organizationId: "org-demo", role: "OWNER", email: "owner@opticalmanager.in" };
    }
    const token = authHeader.replace("Bearer ", "");
    return this.authService.validateSsoToken(token);
  }

  @Get("conversations")
  async getConversations(
    @Query("filter") filter?: string,
    @Query("search") search?: string,
    @Query("instanceId") instanceId?: string,
    @Query("campaignId") campaignId?: string,
    @Headers("authorization") authHeader?: string
  ) {
    const session = this.extractSession(authHeader);
    const data = await this.chatService.getConversations(
      session.organizationId,
      filter,
      search,
      instanceId,
      campaignId
    );
    return { success: true, data };
  }

  @Get("conversations/:id/messages")
  async getMessages(
    @Param("id") conversationId: string,
    @Query("limit") limit?: string,
    @Query("campaignId") campaignId?: string,
    @Headers("authorization") authHeader?: string
  ) {
    const session = this.extractSession(authHeader);
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const data = await this.chatService.getMessages(conversationId, session.organizationId, limitNum, campaignId);
    return { success: true, data };
  }

  @Post("send")
  async sendMessage(
    @Body()
    body: {
      conversationId?: string;
      phone: string;
      instanceId?: string;
      text?: string;
      mediaUrl?: string;
      messageType?: string;
    },
    @Headers("authorization") authHeader?: string
  ) {
    const session = this.extractSession(authHeader);
    const result = await this.chatService.sendMessage(session.organizationId, body);
    return result;
  }

  @Post("conversations/:id/mark-read")
  async markRead(
    @Param("id") conversationId: string,
    @Headers("authorization") authHeader?: string
  ) {
    const session = this.extractSession(authHeader);
    const success = await this.chatService.markConversationRead(conversationId, session.organizationId);
    return { success };
  }

  @Post("conversations/:id/clear")
  async clearConversation(
    @Param("id") conversationId: string,
    @Headers("authorization") authHeader?: string
  ) {
    const session = this.extractSession(authHeader);
    const success = await this.chatService.clearConversation(conversationId, session.organizationId);
    return { success };
  }

  @Delete("clear-all")
  async clearAll(
    @Query("instanceId") instanceId?: string,
    @Headers("authorization") authHeader?: string
  ) {
    const session = this.extractSession(authHeader);
    const success = await this.chatService.clearAll(session.organizationId, instanceId);
    return { success };
  }
}
