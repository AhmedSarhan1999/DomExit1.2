export interface MessengerIncomingEvent {
  type: 'message' | 'callback' | 'start' | 'unknown';
  senderId: string;
  senderName?: string;
  senderUsername?: string;
  text?: string;
  callbackData?: string;
  messageId?: string;
  raw?: any;
}

export interface SendMessageParams {
  recipientId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  replyMarkup?: any;
  replyToMessageId?: string | number;
}

export interface SendNotificationParams {
  recipientId: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionTitle?: string;
}

export interface SendMessageResult {
  ok: boolean;
  messageId?: string;
  description?: string;
  error?: string;
}

export interface IMessengerProvider {
  readonly name: 'telegram' | 'max' | 'mock';

  isConfigured(): boolean;

  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;

  sendNotification(params: SendNotificationParams): Promise<{ ok: boolean; error?: string }>;

  parseWebhookPayload(body: any): MessengerIncomingEvent | null;
}
