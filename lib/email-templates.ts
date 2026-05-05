// HTML email templates. Pure string functions — no JSX, no React Email install.
// Visual style: clean, serif body, generous whitespace, blue accent. Mobile-first.

const BASE_STYLES = `
  body { margin: 0; padding: 0; background: #f9fafb; font-family: Georgia, 'Times New Roman', serif; color: #374151; line-height: 1.6; }
  .container { max-width: 560px; margin: 0 auto; background: #ffffff; padding: 40px 32px; }
  .progress { font-size: 13px; color: #6b7280; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 8px; }
  .progress-bar { height: 4px; background: #e5e7eb; border-radius: 2px; margin-bottom: 32px; }
  .progress-fill { height: 100%; background: #3b82f6; border-radius: 2px; }
  .body { font-size: 18px; line-height: 1.7; margin: 0 0 24px; }
  .media { margin: 24px 0; }
  .media img, .media video { max-width: 100%; border-radius: 8px; }
  .media audio { width: 100%; }
  .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #9ca3af; font-family: -apple-system, system-ui, sans-serif; }
  a { color: #3b82f6; }
`;

function wrap(title: string, inner: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)}</title>
<style>${BASE_STYLES}</style></head>
<body><div class="container">${inner}</div></body></html>`;
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export type MediaItem =
  | { type: 'photo'; url: string; caption?: string }
  | { type: 'video'; url: string; caption?: string }
  | { type: 'youtube'; url: string; caption?: string }
  | { type: 'audio'; url: string; caption?: string };

function renderMedia(items: MediaItem[]): string {
  if (!items.length) return '';
  return items.map((m) => {
    const cap = m.caption ? `<p style="font-size:14px;color:#6b7280;margin-top:8px;">${escapeHTML(m.caption)}</p>` : '';
    if (m.type === 'photo') return `<div class="media"><img src="${escapeHTML(m.url)}" alt="">${cap}</div>`;
    if (m.type === 'video') return `<div class="media"><video controls src="${escapeHTML(m.url)}"></video>${cap}</div>`;
    if (m.type === 'audio') return `<div class="media"><audio controls src="${escapeHTML(m.url)}"></audio>${cap}</div>`;
    if (m.type === 'youtube') {
      const id = extractYoutubeId(m.url);
      if (!id) return `<div class="media"><a href="${escapeHTML(m.url)}">${escapeHTML(m.url)}</a>${cap}</div>`;
      return `<div class="media"><a href="${escapeHTML(m.url)}"><img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="Watch on YouTube" style="max-width:100%;border-radius:8px;"></a>${cap}</div>`;
    }
    return '';
  }).join('');
}

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Daily morning email TO THE BUYER — they copy and text it to their mom.
// Uses the ND-safe ✓ done / → now / next: pattern.
// Day 3 (Mother's Day) is the finale and includes the forever-page link.
export function dailyMessageEmail(args: {
  day: 1 | 2 | 3;
  message: string;
  momName?: string;
  media?: MediaItem[];
  foreverUrl?: string;
  landingUrl?: string;
  contributeUrl?: string;
}): { subject: string; html: string } {
  const { day, message, momName, media = [], foreverUrl, landingUrl, contributeUrl } = args;
  const isFinale = day === 3;
  const fillPercent = (day / 3) * 100;
  const who = momName ? escapeHTML(momName) : 'mom';
  const whoCap = who.charAt(0).toUpperCase() + who.slice(1);

  const doneLine = day > 1
    ? `<div style="color:#15803d;font-size:13px;font-weight:500;">✓ Sent Message ${day - 1} yesterday</div>`
    : '';
  const currentLine = `<div style="color:#111827;font-size:15px;font-weight:600;margin-top:4px;">→ Message ${day} of 3 — copy and text to ${who}</div>`;
  const nextLine = isFinale
    ? `<div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:6px;">Next: that's the whole sequence. You did it.</div>`
    : day === 2
      ? `<div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:6px;">Next: Message 3 — Mother's Day morning — drops in your inbox tomorrow.</div>`
      : `<div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:6px;">Next: Message 2 hits your inbox tomorrow morning.</div>`;

  // Action buttons: Text Mom / Email Mom. Copy isn't possible in HTML email
  // (no JS), so we let the user select the styled message block manually.
  const smsHref = `sms:?body=${encodeURIComponent(message)}`;
  const mailSubject = momName ? `For you, ${momName}` : '💌';
  const mailHref = `mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(message)}`;
  const actions = `
    <p style="font-size:14px;color:#6b7280;margin:18px 0 8px;font-family:-apple-system,system-ui,sans-serif;">
      Send it however works:
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
      <tr>
        <td style="padding-right:8px;">
          <a href="${escapeHTML(smsHref)}" style="display:inline-block;padding:10px 14px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">💬 Text Mom</a>
        </td>
        <td>
          <a href="${escapeHTML(mailHref)}" style="display:inline-block;padding:10px 14px;background:#fff;color:#3b82f6;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #3b82f6;">📧 Email Mom</a>
        </td>
      </tr>
    </table>`;

  // Day 3 only — forever link (clean, for sharing to mom) + edit link for the
  // creator + the high-emotion contribute ask.
  const foreverEditUrl = foreverUrl ? `${foreverUrl}?edit=true` : '';
  const foreverSection = isFinale && foreverUrl
    ? `
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;">
      <p style="font-size:16px;color:#374151;margin:0 0 12px;line-height:1.6;">
        We made something for her — send her this link:
      </p>
      <p style="margin:0 0 12px;"><a href="${escapeHTML(foreverUrl)}" style="color:#9f1239;font-family:ui-monospace,monospace;font-size:14px;word-break:break-all;">${escapeHTML(foreverUrl)}</a></p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 8px;line-height:1.6;">
        A private page she can revisit for a full year. All your messages, your photos, a letter from you. Save a copy any time before it expires.
      </p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px;line-height:1.6;">
        You can always add more photos later — even one from today. <a href="${escapeHTML(foreverEditUrl)}" style="color:#e11d48;font-weight:500;">Edit your page →</a>
      </p>
      <p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.6;font-style:italic;">
        Happy Mother&rsquo;s Day. You did it. She&rsquo;s going to love this.
      </p>
      ${landingUrl || contributeUrl
        ? `<p style="font-size:14px;color:#6b7280;margin:0;line-height:1.6;">
            If this meant something to you${landingUrl ? `, <a href="${escapeHTML(landingUrl)}" style="color:#e11d48;font-weight:500;">share it</a>` : ''}${landingUrl && contributeUrl ? ' or ' : ''}${contributeUrl ? `<a href="${escapeHTML(contributeUrl)}" style="color:#e11d48;font-weight:500;">help keep it free</a>` : ''}.
          </p>`
        : ''}
    </div>`
    : '';

  // Footer pitch: normal weight on Days 1+2 only. Day 3's contribute ask
  // lives inside foreverSection (right after "Happy Mother's Day") so it
  // catches the emotional peak. No duplicate footer pitch on day 3.
  const footerPitch = !isFinale && (landingUrl || contributeUrl)
    ? `
    <p style="font-size:15px;color:#6b7280;margin-top:28px;line-height:1.55;">
      ${landingUrl ? `Know someone who needs this? <a href="${escapeHTML(landingUrl)}" style="color:#e11d48;font-weight:500;">Share the link</a> — it&rsquo;s free.` : ''}
      ${landingUrl && contributeUrl ? '<br>' : ''}
      ${contributeUrl ? `<a href="${escapeHTML(contributeUrl)}" style="color:#e11d48;font-weight:500;">Contribute</a> to keep it running.` : ''}
    </p>`
    : '';

  const inner = `
    <div style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:14px 0;margin-bottom:18px;">
      ${doneLine}
      ${currentLine}
      <div style="width:100%;background:#e5e7eb;border-radius:9999px;height:5px;margin:9px 0;" role="progressbar" aria-valuenow="${day}" aria-valuemin="0" aria-valuemax="3" aria-label="Message ${day} of 3">
        <div style="background:#3b82f6;height:5px;border-radius:9999px;width:${fillPercent}%;"></div>
      </div>
      ${nextLine}
    </div>
    <p style="font-size:16px;color:#374151;margin:0 0 12px;font-family:-apple-system,system-ui,sans-serif;">
      Send this to ${who} today. Just paste it in a text:
    </p>
    <div style="background:#f9fafb;border-left:4px solid #3b82f6;padding:18px 20px;border-radius:6px;">
      <p style="margin:0;font-size:18px;line-height:1.7;">${escapeHTML(message)}</p>
    </div>
    ${renderMedia(media)}
    ${media.length ? `<p style="font-size:13px;color:#6b7280;margin-top:8px;">↑ Attach the file above to your text too. Long-press → save → attach.</p>` : ''}
    ${actions}
    <p style="font-size:14px;color:#6b7280;margin-top:18px;">
      Or just select the message above, copy, and paste into your texts. ~30 seconds.
    </p>
    <p style="font-size:14px;color:#6b7280;margin-top:6px;">${whoCap} will think you&rsquo;ve been planning for a month.</p>
    ${foreverSection}
    ${footerPitch}
    <div class="footer">
      <p>— Memphis</p>
      <p style="margin-top:10px;font-size:12px;color:#9ca3af;">We email YOU. You text ${who}. We never message her directly.</p>
    </div>`;
  return {
    subject: isFinale
      ? `Message 3 of 3 — Mother's Day morning (30 seconds)`
      : `Message ${day} of 3 — Your message is ready (30 seconds)`,
    html: wrap(`Message ${day} of 3`, inner),
  };
}

// Direct-to-mom variant. Sent to mom_email on the same May 8/9/10 schedule as
// the buyer-relay email, with the buyer bcc'd and reply-to set to the buyer.
// No marketing footer, no contribute link — mom's inbox stays clean.
export function momMessageEmail(args: {
  day: 1 | 2 | 3;
  message: string;
  fromName: string; // buyer's first name (or "Someone" if unknown)
  momName?: string;
  media?: MediaItem[];
  foreverUrl?: string;
}): { subject: string; html: string } {
  const { day, message, fromName, momName, media = [], foreverUrl } = args;
  const isFinale = day === 3;
  const who = momName ? escapeHTML(momName) : 'Mom';
  const safeFrom = escapeHTML(fromName);

  const subject = isFinale
    ? `Happy Mother's Day, ${who} — from ${fromName}`
    : day === 1
      ? `${fromName} wanted you to have this`
      : `One more from ${fromName}`;

  const opening = isFinale
    ? `Happy Mother's Day, ${who}.`
    : day === 1
      ? `${safeFrom} put this together for you.`
      : `${safeFrom} sent another.`;

  const foreverButton = isFinale && foreverUrl
    ? `
    <div style="margin:32px 0 8px;text-align:center;">
      <a href="${escapeHTML(foreverUrl)}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-family:-apple-system,system-ui,sans-serif;font-weight:500;font-size:16px;">
        See the page they made for you →
      </a>
    </div>`
    : '';

  const inner = `
    <p style="font-size:18px;color:#374151;margin:0 0 20px;font-family:-apple-system,system-ui,sans-serif;">
      ${opening}
    </p>
    <div style="background:#f9fafb;border-left:4px solid #e11d48;padding:18px 20px;border-radius:6px;">
      <p style="margin:0;font-size:18px;line-height:1.7;">${escapeHTML(message)}</p>
    </div>
    ${renderMedia(media)}
    ${foreverButton}
    <div class="footer">
      Sent through Mother&rsquo;s Day Messages on ${safeFrom}&rsquo;s behalf.
      Reply to this email to reach ${safeFrom}.
    </div>
  `;

  return { subject, html: wrap(subject, inner) };
}

// Optional afternoon nudge for the ADHD / neurodivergent crowd. Calming tone.
export function gentleReminderEmail(args: {
  day: 1 | 2 | 3;
  message: string;
  momName?: string;
}): { subject: string; html: string } {
  const { day, message, momName } = args;
  const who = momName ? escapeHTML(momName) : 'mom';
  const inner = `
    <div class="progress">Message ${day} of 3 · gentle nudge</div>
    <p style="font-size:18px;color:#374151;margin:0 0 16px;font-family:Georgia,serif;line-height:1.6;">
      Hey. No pressure. Just a soft nudge.
    </p>
    <p style="font-size:16px;color:#374151;margin:0 0 16px;line-height:1.7;">
      If today got away from you, here&rsquo;s the message again. Send it whenever — or
      skip today and send two tomorrow. ${who.charAt(0).toUpperCase() + who.slice(1)} won&rsquo;t notice the gap.
      She&rsquo;ll notice you tried.
    </p>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:18px 20px;border-radius:6px;">
      <p style="margin:0;font-size:17px;line-height:1.7;">${escapeHTML(message)}</p>
    </div>
    <p style="font-size:14px;color:#6b7280;margin-top:24px;font-style:italic;">
      Take a breath. You&rsquo;re doing the thing. That&rsquo;s the part that counts.
    </p>
    <div class="footer">
      <p>— Memphis<br>(another neurodivergent dude making things for messes)</p>
      <p style="margin-top:10px;font-size:12px;color:#9ca3af;">We email YOU. You text ${who}. We never message her directly.</p>
    </div>`;
  return {
    subject: `gentle nudge — Message ${day} of 3`,
    html: wrap(`Gentle reminder — Message ${day}`, inner),
  };
}

export function confirmationEmail(args: {
  orderId: string;
  momName?: string;
  userName?: string;
  editUrl: string;
  firstSendDate: string; // pretty
  isFree?: boolean;
  landingUrl?: string;
  contributeUrl?: string;
  deliveryMode?: 'self' | 'mom';
}): { subject: string; html: string } {
  const who = args.momName ? escapeHTML(args.momName) : 'mom';
  const mode = args.deliveryMode ?? 'self';
  const headerLine = args.isFree ? '✓ You&rsquo;re in' : '✓ Paid';
  const tipLine =
    args.landingUrl || args.contributeUrl
      ? `<p style="margin-top:14px;font-size:13px;color:#777;line-height:1.5;">
          This is free for everyone.
          ${args.landingUrl ? ` Share: <a href="${escapeHTML(args.landingUrl)}" style="color:#e11d48;">${escapeHTML(args.landingUrl)}</a>` : ''}
          ${args.landingUrl && args.contributeUrl ? ' · ' : ''}
          ${args.contributeUrl ? `Contribute: <a href="${escapeHTML(args.contributeUrl)}" style="color:#e11d48;">tip jar</a>` : ''}
        </p>`
      : '';
  const deliveryLine = mode === "mom"
    ? `<div style="color:#6b7280;font-size:12px;margin-top:6px;">Delivery: Send directly to ${who} &mdash; you&rsquo;ll get a copy of each message.</div>`
    : `<div style="color:#6b7280;font-size:12px;margin-top:6px;">Delivery: Send to me &mdash; messages emailed to you to forward.</div>`;
  const bodyPara = mode === "mom"
    ? `<p>Starting <strong>${escapeHTML(args.firstSendDate)}</strong>, we email each message directly to ${who}. You&rsquo;ll get a copy of each one &mdash; Friday, Saturday, Sunday morning.</p>`
    : `<p>Starting <strong>${escapeHTML(args.firstSendDate)}</strong>, we email you each morning with that day&rsquo;s message. Copy it. Paste in a text to ${who}. Send. Done. ~30 seconds a day. Three messages total &mdash; Friday, Saturday, Sunday morning.</p>`;
  const footerDisclaimer = mode === "mom"
    ? `<p style="margin-top:10px;font-size:12px;color:#9ca3af;">Each message goes directly to ${who}. You&rsquo;ll get a copy of each one.</p>`
    : `<p style="margin-top:10px;font-size:12px;color:#9ca3af;">We email YOU. You text ${who}. We never message her directly.</p>`;
  const fromLabel = args.userName ? (escapeHTML(args.userName) + " for Mother&rsquo;s Day") : "you";
  const headsUpLine = mode === "mom"
    ? `<p style="margin-top:14px;font-size:14px;color:#374151;">Give ${who} a heads up &mdash; she&rsquo;ll see the emails come from &ldquo;${fromLabel}&rdquo; so she knows it&rsquo;s from you.</p>`
    : '';
  const inner = `
    <div style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:14px 0;margin-bottom:18px;">
      <div style="color:#15803d;font-size:13px;font-weight:500;">${headerLine}</div>
      <div style="color:#111827;font-size:15px;font-weight:600;margin-top:4px;">→ All set. Nothing else for you to do until ${escapeHTML(args.firstSendDate)}.</div>
      ${deliveryLine}
      <div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:4px;">Next: First morning email lands ${escapeHTML(args.firstSendDate)}. Two more after that, through Mother&rsquo;s Day.</div>
    </div>
    <h1 style="font-family:-apple-system,system-ui,sans-serif;font-size:24px;margin:0 0 16px;">You&rsquo;re set.</h1>
    ${bodyPara}
    ${headsUpLine}
    <p style="margin-top:24px;">Want to change something? Edit messages, photos, or your delivery time:</p>
    <p style="margin-top:8px;"><a href="${escapeHTML(args.editUrl)}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">Edit your messages</a></p>
    <div class="footer">
      <p>Order ${escapeHTML(args.orderId.slice(0, 8))}. Reply if anything looks off.</p>
      <p style="margin-top:14px;font-family:Georgia,serif;color:#9f1239;">#doitforbonnie</p>
      <p style="font-size:11px;color:#9ca3af;font-style:italic;">Built this for my mom Bonnie. Use the tag with yours.</p>
      ${footerDisclaimer}
      ${tipLine}
    </div>`;
  return { subject: 'Mother’s Day — confirmed', html: wrap('Confirmed', inner) };
}

// May 7th 7pm reminder — "tomorrow it starts."
export function reminderEveEmail(args: {
  momName?: string;
  landingUrl?: string;
  contributeUrl?: string;
}): { subject: string; html: string } {
  const who = args.momName ? escapeHTML(args.momName) : 'mom';
  const tipLine =
    args.landingUrl || args.contributeUrl
      ? `<p style="margin-top:14px;font-size:13px;color:#777;line-height:1.5;">
          This is free for everyone.
          ${args.landingUrl ? ` Share: <a href="${escapeHTML(args.landingUrl)}" style="color:#e11d48;">${escapeHTML(args.landingUrl)}</a>` : ''}
          ${args.landingUrl && args.contributeUrl ? ' · ' : ''}
          ${args.contributeUrl ? `Contribute: <a href="${escapeHTML(args.contributeUrl)}" style="color:#e11d48;">tip jar</a>` : ''}
        </p>`
      : '';
  const inner = `
    <h1 style="font-family:-apple-system,system-ui,sans-serif;font-size:22px;margin:0 0 16px;">Tomorrow morning, it starts ✉️</h1>
    <p style="font-size:16px;color:#374151;line-height:1.7;">
      Hey — your 1st message arrives tomorrow at 9am.
    </p>
    <p style="font-size:16px;color:#374151;line-height:1.7;margin-top:14px;">
      When it lands, just copy and send it to ${who}. That&rsquo;s it. 30 seconds.
    </p>
    <p style="font-size:16px;color:#374151;line-height:1.7;margin-top:14px;">
      3 messages over 3 days. She&rsquo;s going to love it.
    </p>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin-top:18px;font-style:italic;">
      Talk tomorrow.
    </p>
    <div class="footer">
      <p>— Memphis</p>
      ${tipLine}
    </div>`;
  return { subject: 'Tomorrow morning, it starts ✉️', html: wrap('Tomorrow', inner) };
}

export function editClosingReminderEmail(args: { editUrl: string }): { subject: string; html: string } {
  const inner = `
    <h1 style="font-family:-apple-system,system-ui,sans-serif;font-size:22px;margin:0 0 16px;">Last chance to edit</h1>
    <p>Edit window closes tonight at 11:59pm. After that, messages are locked in.</p>
    <p style="margin-top:24px;"><a href="${escapeHTML(args.editUrl)}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">Review &amp; edit</a></p>
    <div class="footer">
      <p>If everything looks good, ignore this.</p>
      <p style="margin-top:10px;font-size:12px;color:#9ca3af;">We email YOU. You text mom. We never message her directly.</p>
    </div>`;
  return { subject: 'Last chance to edit (closes tonight)', html: wrap('Last chance', inner) };
}

export function huntReminderEmail(args: { huntUrl: string; momName?: string }): { subject: string; html: string } {
  const who = args.momName ? escapeHTML(args.momName) : 'her';
  const inner = `
    <h1 style="font-family:-apple-system,system-ui,sans-serif;font-size:22px;margin:0 0 16px;">Send the hunt tomorrow morning</h1>
    <p>Tomorrow is Mother&rsquo;s Day (May 10th). After ${who} reads Day 7 of her messages, text or email this link from your phone:</p>
    <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-family:ui-monospace,monospace;font-size:13px;white-space:pre-wrap;word-break:break-all;">${escapeHTML(args.huntUrl)}</pre>
    <p style="margin-top:16px;">She&rsquo;ll click → solve 5 clues → see your finale.</p>
    <p style="margin-top:24px;font-size:14px;color:#6b7280;">Suggested message: &ldquo;Happy Mother&rsquo;s Day. I made you something. ${escapeHTML(args.huntUrl)}&rdquo;</p>
    <div class="footer"><p>30 seconds of work. She&rsquo;ll think it took hours.</p></div>`;
  return { subject: 'Hunt link — send tomorrow morning', html: wrap('Hunt reminder', inner) };
}

// Standalone forever-page email. In the new flow, the forever-page link is
// inlined into Message 3 (Mother's Day morning), so this function isn't
// scheduled by default — kept exported for any caller that wants it explicitly.
export function foreverPageEmail(args: {
  foreverUrl: string;
  momName?: string;
  userName?: string;
}): { subject: string; html: string } {
  const who = args.momName ? escapeHTML(args.momName) : 'mom';
  const inner = `
    <div style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:14px 0;margin-bottom:18px;">
      <div style="color:#15803d;font-size:13px;font-weight:500;">✓ All 3 messages sent</div>
      <div style="color:#111827;font-size:15px;font-weight:600;margin-top:4px;">→ Mother's Day morning — your Forever Page is ready</div>
      <div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:6px;">Next: send ${who} the link, then go enjoy the day.</div>
    </div>
    <h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 14px;color:#374151;">It&rsquo;s ready.</h1>
    <p style="font-size:16px;color:#374151;line-height:1.7;">
      Send ${who} this link this morning. Just paste it in a text:
    </p>
    <div style="background:#fff1f2;border-left:4px solid #f43f5e;padding:18px 20px;border-radius:6px;">
      <p style="margin:0;font-family:ui-monospace,monospace;font-size:14px;word-break:break-all;">
        <a href="${escapeHTML(args.foreverUrl)}" style="color:#9f1239;">${escapeHTML(args.foreverUrl)}</a>
      </p>
    </div>
    <p style="font-size:14px;color:#6b7280;margin-top:20px;">
      All 3 messages, your photos, and the letter — all on one page. She can share it. She can come back to it for a full year — save a copy any time.
    </p>
    <p style="font-size:14px;color:#6b7280;margin-top:14px;">
      Suggested message: &ldquo;Happy Mother&rsquo;s Day. I made you something. ${escapeHTML(args.foreverUrl)}&rdquo;
    </p>
    <div class="footer">
      <p>That&rsquo;s the whole thing. You did it.<br>— Memphis</p>
      <p style="margin-top:10px;font-size:12px;color:#9ca3af;">We email YOU. You text ${who}. We never message her directly.</p>
    </div>`;
  return {
    subject: `Send this to ${who} — your Mother's Day page is ready`,
    html: wrap('Forever Page ready', inner),
  };
}

// Pre-payment "save my work" email — gives the user a link to come back to
// their unfinished /preview state. Pay-what-you-want, no tier upsell.
export function saveProgressEmail(args: {
  resumeUrl: string;
  momName?: string;
}): { subject: string; html: string } {
  const who = args.momName ? escapeHTML(args.momName) : 'her';
  const inner = `
    <h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 14px;color:#374151;">
      I&rsquo;m not crying. You&rsquo;re crying.
    </h1>
    <p style="font-size:16px;color:#374151;line-height:1.7;">
      You wrote real things about ${who}. The AI turned them into something good. We saved
      everything you typed so you can come back whenever &mdash; on your phone, your lunch
      break, tonight when the kids are asleep.
    </p>
    <p style="font-size:16px;color:#374151;margin-top:14px;line-height:1.7;">
      Here&rsquo;s your workspace. It&rsquo;s yours. Open it from any phone or laptop.
    </p>
    <p style="margin:24px 0;">
      <a href="${escapeHTML(args.resumeUrl)}" style="display:inline-block;padding:14px 24px;background:#f43f5e;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">
        Open my workspace →
      </a>
    </p>
    <p style="font-size:14px;color:#6b7280;line-height:1.6;">
      In there you can review your messages, add up to 2 photos, tweak anything, and then
      finish whenever. It&rsquo;s pay-what-you-want, including free. Edits save automatically.
      Come back as many times as you want.
    </p>
    <div class="footer">
      <p>No expiration on this link. We&rsquo;ll be here.<br>— Memphis</p>
      <p style="margin-top:10px;font-size:12px;color:#9ca3af;">We email YOU. You text ${who}. We never message her directly.</p>
    </div>`;
  return {
    subject: `Your Mother's Day workspace — pick up where you left off`,
    html: wrap('Your workspace', inner),
  };
}

export function magicLinkEmail(args: { editUrl: string }): { subject: string; html: string } {
  const inner = `
    <h1 style="font-family:-apple-system,system-ui,sans-serif;font-size:22px;margin:0 0 16px;">Edit link</h1>
    <p>Click to edit your Mother&rsquo;s Day messages. Link is good for 1 hour.</p>
    <p style="margin-top:16px;"><a href="${escapeHTML(args.editUrl)}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">Open editor</a></p>
    <div class="footer"><p>Didn&rsquo;t request this? Ignore the email.</p></div>`;
  return { subject: 'Your edit link', html: wrap('Edit link', inner) };
}
