// Single source of truth for scheduling Mother's Day outbound emails:
//   - May 7 7pm user-local: "tomorrow it starts" reminder
//   - May 8/9/10 user-time: the 3 daily messages
// Called by both the paid path (stripe-webhook) and the free path (create-checkout).
// Every sendEmail call passes orderId + emailType so the sent_emails gate fires
// and Resend's Idempotency-Key dedupes server-side.

import { sendEmail } from './resend';
import { dailyMessageEmail, reminderEveEmail } from './email-templates';
import { deliveryISOForDay, localToUTC } from './dates';

type OrderForScheduling = {
  id: string;
  user_email: string;
  delivery_time: string | null;
  delivery_timezone: string;
  mom_name: string | null;
  messages: Record<string, unknown>;
  media?: unknown[] | null;
};

const REMINDER_DATE = '2026-05-07';
const REMINDER_TIME = '19:00';

export async function scheduleDailyEmails(
  order: OrderForScheduling,
): Promise<{ scheduledIds: Record<string, string>; failures: Array<{ day: number | string; error: string }> }> {
  const scheduledIds: Record<string, string> = {};
  const failures: Array<{ day: number | string; error: string }> = [];

  const morningTime = order.delivery_time || '09:00';
  const landingUrl = process.env.NEXT_PUBLIC_URL || '';
  const foreverUrl = `${landingUrl}/forever/${order.id}`;
  const contributeUrl = `${landingUrl}/success?orderId=${order.id}#contribute`;

  // 1. May 7 7pm reminder — "tomorrow it starts"
  {
    const tpl = reminderEveEmail({
      momName: order.mom_name || undefined,
      landingUrl,
      contributeUrl,
    });
    const sendAt = localToUTC(REMINDER_DATE, REMINDER_TIME, order.delivery_timezone);
    // Only schedule if it's still in the future. If it's already past May 7 7pm
    // user-local (e.g., last-minute order on May 8), skip — the daily messages
    // do the work.
    if (new Date(sendAt) > new Date()) {
      const r = await sendEmail({
        to: order.user_email,
        subject: tpl.subject,
        html: tpl.html,
        scheduledAt: sendAt,
        tag: 'reminder-eve',
        orderId: order.id,
        emailType: 'reminder_eve',
      });
      if (r.ok) {
        scheduledIds['reminder_eve'] = r.id;
      } else {
        failures.push({ day: 'reminder_eve', error: r.error });
      }
    }
  }

  // 2. May 8/9/10 daily messages
  for (const day of [1, 2, 3] as const) {
    const message = order.messages?.[`day_${day}`];
    if (typeof message !== 'string' || !message.length) {
      failures.push({ day, error: `messages.day_${day} missing` });
      continue;
    }
    const dayMedia = (order.media || []).filter(
      (m): m is { day: number; type: 'photo' | 'video' | 'youtube' | 'audio'; url: string; caption?: string } => {
        if (typeof m !== 'object' || m === null) return false;
        const obj = m as { day?: unknown };
        return typeof obj.day === 'number' && obj.day === day;
      },
    );
    const tpl = dailyMessageEmail({
      day,
      message,
      momName: order.mom_name || undefined,
      media: dayMedia,
      foreverUrl: day === 3 ? foreverUrl : undefined,
      landingUrl,
      contributeUrl,
    });
    const sendAt = deliveryISOForDay(day, morningTime, order.delivery_timezone);
    const r = await sendEmail({
      to: order.user_email,
      subject: tpl.subject,
      html: tpl.html,
      scheduledAt: sendAt,
      tag: `message-${day}`,
      orderId: order.id,
      emailType: `message_day_${day}`,
    });
    if (r.ok) {
      scheduledIds[`message_day_${day}`] = r.id;
    } else {
      failures.push({ day, error: r.error });
    }
  }

  return { scheduledIds, failures };
}
