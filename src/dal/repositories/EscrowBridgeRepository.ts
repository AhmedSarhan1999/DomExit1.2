import { EscrowChatMessage } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';

const COLLECTION = 'escrow_bridge_chats';

const INITIAL_MESSAGES: EscrowChatMessage[] = [
  {
    id: 'msg-seed-1',
    dealId: 'DEAL-2025-10566',
    senderRole: 'curator',
    senderName: 'Куратор DomExit (Алексей Смирнов)',
    text: 'Сделка переведена в контур эскроу-расчетов по 214-ФЗ. Ответственный сотрудник банка подключен к защищенному шлюзу.',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    isEncryptedNotice: true,
  },
  {
    id: 'msg-seed-2',
    dealId: 'DEAL-2025-10566',
    senderRole: 'bank_officer',
    senderName: 'Ольга Николаева (Старший специалист по эскроу, Сбербанк)',
    text: 'Здравствуйте! Мы сформировали специальный эскроу-счет для расчетов по договору уступки прав требования по лоту #U-10566. Ниже направляю официальные реквизиты для внесения депозита.',
    timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
  },
  {
    id: 'msg-seed-3',
    dealId: 'DEAL-2025-10566',
    senderRole: 'bank_officer',
    senderName: 'Ольга Николаева (Сбербанк)',
    text: 'Реквизиты спецсчета эскроу (214-ФЗ):\nПолучатель: ПАО Сбербанк / Специальный счет эскроу\nСчет эскроу: 40817810438090124851\nБИК: 044525225\nКорр. счет: 30101810400000000225\nСумма покрытия: 2 485 230 ₽\nНазначение: Депонирование по договору цессии ДДУ № ЧН-12/2-10566',
    attachmentType: 'requisites',
    attachmentName: 'Реквизиты_эскроу_DEAL-2025-10566.pdf',
    timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
];

type ChatListener = (messages: EscrowChatMessage[]) => void;
const listeners = new Map<string, Set<ChatListener>>();

export class EscrowBridgeRepository {
  static async getAll(): Promise<EscrowChatMessage[]> {
    const list = await DatabaseGateway.getAll<EscrowChatMessage>(COLLECTION, INITIAL_MESSAGES);
    return list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  static async getMessages(dealId: string): Promise<EscrowChatMessage[]> {
    const all = await this.getAll();
    const cleanId = (dealId || '').trim().toUpperCase();
    const filtered = all.filter((m) => m.dealId?.trim().toUpperCase() === cleanId);
    if (filtered.length === 0 && cleanId.includes('10566')) {
      return INITIAL_MESSAGES;
    }
    return filtered;
  }

  static async sendMessage(
    dealId: string,
    message: Omit<EscrowChatMessage, 'id' | 'timestamp'>
  ): Promise<EscrowChatMessage> {
    const cleanId = (dealId || 'DEAL-DEFAULT').trim().toUpperCase();
    const newMsg: EscrowChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealId: cleanId,
      timestamp: new Date().toISOString(),
    };

    await DatabaseGateway.save<EscrowChatMessage>(COLLECTION, newMsg);

    // Notify active real-time listeners for this deal
    this.notifyListeners(cleanId);

    return newMsg;
  }

  static subscribeToDealChat(dealId: string, onUpdate: ChatListener): () => void {
    const cleanId = (dealId || '').trim().toUpperCase();
    if (!listeners.has(cleanId)) {
      listeners.set(cleanId, new Set());
    }
    listeners.get(cleanId)!.add(onUpdate);

    // Initial emit
    this.getMessages(cleanId).then((msgs) => onUpdate(msgs));

    return () => {
      const set = listeners.get(cleanId);
      if (set) {
        set.delete(onUpdate);
        if (set.size === 0) {
          listeners.delete(cleanId);
        }
      }
    };
  }

  private static async notifyListeners(dealId: string) {
    const set = listeners.get(dealId);
    if (set && set.size > 0) {
      const msgs = await this.getMessages(dealId);
      set.forEach((listener) => {
        try {
          listener(msgs);
        } catch (e) {
          console.warn('EscrowBridge listener error:', e);
        }
      });
    }
  }
}
