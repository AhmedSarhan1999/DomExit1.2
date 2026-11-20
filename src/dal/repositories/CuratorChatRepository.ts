import { CuratorMessage } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';

const COLLECTION = 'deal_messages';

export class CuratorChatRepository {
  /**
   * Retrieves messages for a specific lot or deal, sorted chronologically.
   */
  static async getMessages(lotIdOrCode: string, dealId?: string): Promise<CuratorMessage[]> {
    const cleanLot = (lotIdOrCode || '').trim().toUpperCase();
    const cleanDeal = (dealId || '').trim().toUpperCase();

    const all = await DatabaseGateway.getAll<CuratorMessage>(COLLECTION);

    const filtered = all.filter((m) => {
      const matchLot =
        cleanLot &&
        ((m.lotCode && m.lotCode.toUpperCase() === cleanLot) ||
          (m.lotId && m.lotId.toUpperCase() === cleanLot));
      const matchDeal = cleanDeal && m.dealId && m.dealId.toUpperCase() === cleanDeal;
      return matchLot || matchDeal;
    });

    return filtered.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /**
   * Sends a message into the deal_messages collection in Yandex YDB.
   */
  static async sendMessage(
    msg: Omit<CuratorMessage, 'id' | 'createdAt' | 'isRead'> & { isRead?: boolean }
  ): Promise<CuratorMessage> {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newMsg: CuratorMessage = {
      ...msg,
      id,
      lotCode: (msg.lotCode || msg.lotId || '').toUpperCase(),
      createdAt: new Date().toISOString(),
      isRead: msg.isRead ?? false,
    };

    return await DatabaseGateway.save<CuratorMessage>(COLLECTION, newMsg);
  }

  /**
   * Marks specified messages as read.
   */
  static async markAsRead(messageIds: string[]): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;
    const all = await DatabaseGateway.getAll<CuratorMessage>(COLLECTION);
    const idSet = new Set(messageIds);

    for (const msg of all) {
      if (idSet.has(msg.id) && !msg.isRead) {
        msg.isRead = true;
        await DatabaseGateway.save<CuratorMessage>(COLLECTION, msg);
      }
    }
  }

  /**
   * Counts unread messages for a specific curator (or all for platform owner).
   */
  static async getUnreadCountForCurator(curatorId?: string, isOwner: boolean = false): Promise<number> {
    const all = await DatabaseGateway.getAll<CuratorMessage>(COLLECTION);
    return all.filter((m) => {
      if (m.isRead) return false;
      // Incoming messages from buyer or seller
      if (m.senderRole === 'employee' || m.senderRole === 'owner') return false;
      if (isOwner) return true;
      return !curatorId || m.curatorId === curatorId;
    }).length;
  }

  /**
   * Groups messages by conversation thread (lotCode or dealId).
   */
  static async getRecentDialogs(
    curatorId?: string,
    isOwner: boolean = false
  ): Promise<
    Array<{
      lotCode: string;
      dealId?: string;
      senderName: string;
      senderRole: string;
      lastMessage: CuratorMessage;
      unreadCount: number;
    }>
  > {
    const all = await DatabaseGateway.getAll<CuratorMessage>(COLLECTION);

    // Group by identifier
    const dialogsMap = new Map<string, CuratorMessage[]>();
    for (const msg of all) {
      if (!isOwner && curatorId && msg.curatorId && msg.curatorId !== curatorId) {
        continue;
      }
      const key = (msg.lotCode || msg.lotId || msg.dealId || 'general').toUpperCase();
      if (!dialogsMap.has(key)) {
        dialogsMap.set(key, []);
      }
      dialogsMap.get(key)!.push(msg);
    }

    const results = [];
    for (const [key, msgs] of dialogsMap.entries()) {
      msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const last = msgs[0];
      const unreads = msgs.filter(
        (m) => !m.isRead && (m.senderRole === 'buyer' || m.senderRole === 'seller')
      ).length;

      results.push({
        lotCode: key,
        dealId: last.dealId,
        senderName: last.senderName,
        senderRole: last.senderRole,
        lastMessage: last,
        unreadCount: unreads,
      });
    }

    return results.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
  }

  /**
   * Subscribes to real-time message changes.
   */
  static subscribe(callback: () => void): () => void {
    return DatabaseGateway.subscribe((collection) => {
      if (!collection || collection.includes('deal_messages') || collection.includes('curator_messages')) {
        callback();
      }
    });
  }
}
