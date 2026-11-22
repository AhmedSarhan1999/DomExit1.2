import { sendEmail, renderNotificationEmail, maskEmail } from './emailService.js';
import { getActiveMessenger } from './messenger/messengerRegistry.js';
import { getYdbClient } from './ydbClient.js';
import { logger } from './logger.js';

export interface DispatchNotificationOptions {
  userId?: string;
  recipientEmail?: string;
  recipientMessengerId?: string;
  subject?: string;
  title: string;
  body: string;
  actionUrl?: string;
  actionTitle?: string;
  highlightDetails?: Record<string, string>;
  channels?: ('email' | 'messenger')[];
}

export interface DispatchNotificationResult {
  emailSent: boolean;
  messengerSent: boolean;
  errors: string[];
}

/**
 * Universal Notification Dispatcher
 *
 * Coordinates delivery across Email (primary / legal records) and
 * Active Messenger (Telegram / MAX - real-time interactive) in isolated try/catch blocks.
 * Neither channel failure can crash caller workflows.
 */
export async function dispatchNotification(
  opts: DispatchNotificationOptions
): Promise<DispatchNotificationResult> {
  const result: DispatchNotificationResult = {
    emailSent: false,
    messengerSent: false,
    errors: [],
  };

  const channels = opts.channels || ['email', 'messenger'];
  let targetEmail = opts.recipientEmail?.trim();
  let targetMessengerId = opts.recipientMessengerId?.trim();

  // If userId provided and contacts not explicitly set, try resolving from database
  if (opts.userId && (!targetEmail || !targetMessengerId)) {
    try {
      const ydb = getYdbClient();
      const user = await ydb.getItem<any>('users', opts.userId);
      if (user) {
        if (!targetEmail && user.email) targetEmail = String(user.email).trim();
      }

      if (!targetMessengerId) {
        const bindings = await ydb.scanAll('telegram_bindings', 100);
        const binding = bindings.find((b: any) => b.userId === opts.userId);
        if (binding?.chatId && binding.notificationsEnabled !== false) {
          targetMessengerId = String(binding.chatId).trim();
        }
      }
    } catch (dbErr: any) {
      logger.warn('[NotificationDispatcher] Could not resolve user contacts from DB', {
        meta: { userId: opts.userId, error: dbErr.message },
      });
    }
  }

  // 1. Deliver via Email (Primary / Formal)
  if (channels.includes('email') && targetEmail) {
    try {
      const emailContent = renderNotificationEmail({
        title: opts.title,
        message: opts.body,
        actionUrl: opts.actionUrl,
        actionLabel: opts.actionTitle,
        highlightDetails: opts.highlightDetails,
      });

      const emailRes = await sendEmail({
        to: targetEmail,
        subject: opts.subject || emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      result.emailSent = emailRes.success;
      if (!emailRes.success && emailRes.error) {
        result.errors.push(`Email error: ${emailRes.error}`);
      }
    } catch (emailErr: any) {
      logger.warn('[NotificationDispatcher] Email delivery exception', {
        meta: { recipient: maskEmail(targetEmail), error: emailErr.message },
      });
      result.errors.push(`Email exception: ${emailErr.message}`);
    }
  }

  // 2. Deliver via Active Messenger (Telegram / MAX)
  if (channels.includes('messenger') && targetMessengerId) {
    try {
      const messenger = getActiveMessenger();
      if (messenger.isConfigured() || messenger.name === 'max') {
        const messengerRes = await messenger.sendNotification({
          recipientId: targetMessengerId,
          title: opts.title,
          body: opts.body,
          actionUrl: opts.actionUrl,
          actionTitle: opts.actionTitle,
        });

        result.messengerSent = messengerRes.ok;
        if (!messengerRes.ok && messengerRes.error) {
          result.errors.push(`Messenger error (${messenger.name}): ${messengerRes.error}`);
        }
      }
    } catch (msgErr: any) {
      logger.warn('[NotificationDispatcher] Messenger delivery exception', {
        meta: { recipientId: targetMessengerId, error: msgErr.message },
      });
      result.errors.push(`Messenger exception: ${msgErr.message}`);
    }
  }

  return result;
}

export const notificationDispatcher = {
  dispatch: dispatchNotification,
};
