import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ChatService } from "./chat.service";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentOrg } from "../auth/decorators/tenant.decorator";

@UseGuards(TenantAuthGuard)
@Controller("chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService
  ) {}

  @Get("conversations")
  async getConversations(
    @CurrentOrg() orgId: string,
    @Query("filter") filter?: string,
    @Query("search") search?: string,
    @Query("instanceId") instanceId?: string,
    @Query("campaignId") campaignId?: string
  ) {
    const data = await this.chatService.getConversations(
      orgId,
      filter,
      search,
      instanceId,
      campaignId
    );
    return { success: true, data };
  }

  @Get("conversations/:id/messages")
  async getMessages(
    @CurrentOrg() orgId: string,
    @Param("id") conversationId: string,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
    @Query("campaignId") campaignId?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 30;
    const result = await this.chatService.getMessages(conversationId, orgId, limitNum, before, campaignId);
    return { success: true, data: result.messages, hasMore: result.hasMore };
  }

  @Post("send")
  async sendMessage(
    @CurrentOrg() orgId: string,
    @Body()
    body: {
      conversationId?: string;
      phone: string;
      instanceId?: string;
      text?: string;
      mediaUrl?: string;
      messageType?: string;
      quotedMessageId?: string;
      quotedContent?: string;
      quotedSender?: string;
    }
  ) {
    const result = await this.chatService.sendMessage(orgId, body);
    return result;
  }

  @Post("conversations/:id/mark-read")
  async markRead(
    @CurrentOrg() orgId: string,
    @Param("id") conversationId: string
  ) {
    const success = await this.chatService.markConversationRead(conversationId, orgId);
    return { success };
  }

  @Post("conversations/:id/clear")
  async clearConversation(
    @CurrentOrg() orgId: string,
    @Param("id") conversationId: string
  ) {
    const success = await this.chatService.clearConversation(conversationId, orgId);
    return { success };
  }

  @Delete("clear-all")
  async clearAll(
    @CurrentOrg() orgId: string,
    @Query("instanceId") instanceId?: string
  ) {
    const success = await this.chatService.clearAll(orgId, instanceId);
    return { success };
  }
}

