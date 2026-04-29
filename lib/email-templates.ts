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
export function dailyMessageEmail(args: {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  message: string;
  momName?: string;
  media?: MediaItem[];
  isFinale?: boolean;
}): { subject: string; html: string } {
  const { day, message, momName, media = [], isFinale } = args;
  const fillPercent = (day / 7) * 100;
  const who = momName ? escapeHTML(momName) : 'mom';
  const whoCap = who.charAt(0).toUpperCase() + who.slice(1);

  const doneLine = day > 1
    ? `<div style="color:#15803d;font-size:13px;font-weight:500;">✓ Sent Day ${day - 1} yesterday</div>`
    : '';
  const currentLine = `<div style="color:#111827;font-size:15px;font-weight:600;margin-top:4px;">→ Day ${day} of 7 — copy and text to ${who}</div>`;
  const nextLine = isFinale
    ? `<div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:6px;">Next: that's Day 7. You did it.</div>`
    : day === 6
      ? `<div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:6px;">Next: Day 7 — Mother's Day morning — drops in your inbox tomorrow.</div>`
      : `<div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:6px;">Next: Day ${day + 1} hits your inbox tomorrow morning.</div>`;

  const inner = `
    <div style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:14px 0;margin-bottom:18px;">
      ${doneLine}
      ${currentLine}
      <div style="width:100%;background:#e5e7eb;border-radius:9999px;height:5px;margin:9px 0;">
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
    <p style="font-size:14px;color:#6b7280;margin-top:20px;">
      Copy it. Paste in a text to ${who}. Send. Done. Takes 30 seconds.
    </p>
    <p style="font-size:14px;color:#6b7280;margin-top:6px;">${whoCap} will think you&rsquo;ve been planning for a month.</p>
    <div class="footer">
      <p>— Memphis</p>
    </div>`;
  return {
    subject: isFinale
      ? `Day 7 of 7 — Mother's Day Message Ready (30 seconds)`
      : `Day ${day} of 7 — Your Message is Ready (30 seconds)`,
    html: wrap(`Day ${day} of 7`, inner),
  };
}

// Optional afternoon nudge for the ADHD / neurodivergent crowd. Calming tone.
export function gentleReminderEmail(args: {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  message: string;
  momName?: string;
}): { subject: string; html: string } {
  const { day, message, momName } = args;
  const who = momName ? escapeHTML(momName) : 'mom';
  const inner = `
    <div class="progress">Day ${day} · gentle nudge</div>
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
    </div>`;
  return {
    subject: `gentle nudge — Day ${day}`,
    html: wrap(`Gentle reminder — Day ${day}`, inner),
  };
}

export function confirmationEmail(args: {
  orderId: string;
  tier: 1 | 2 | 3;
  momName?: string;
  editUrl: string;
  firstSendDate: string; // pretty
}): { subject: string; html: string } {
  const tierLabel = args.tier === 1
    ? 'Mother Lover Package'
    : args.tier === 2
      ? 'Mother Lover Package + Feels'
      : 'Mother Lover Package + Feels + Adventure';
  const inner = `
    <div style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:14px 0;margin-bottom:18px;">
      <div style="color:#15803d;font-size:13px;font-weight:500;">✓ Paid for your ${escapeHTML(tierLabel)}</div>
      <div style="color:#111827;font-size:15px;font-weight:600;margin-top:4px;">→ All set. Nothing else for you to do until May 4th.</div>
      <div style="color:#6b7280;font-size:12px;font-style:italic;margin-top:6px;">Next: First morning email lands ${escapeHTML(args.firstSendDate)}. We&rsquo;ll nudge you each morning through Mother&rsquo;s Day.</div>
    </div>
    <h1 style="font-family:-apple-system,system-ui,sans-serif;font-size:24px;margin:0 0 16px;">You&rsquo;re set.</h1>
    <p>Starting <strong>${escapeHTML(args.firstSendDate)}</strong>, we email <em>you</em> each morning with that day&rsquo;s message. Copy it. Paste in a text to ${args.momName ? escapeHTML(args.momName) : 'mom'}. Send. Done. ~30 seconds a day.</p>
    <p style="margin-top:24px;">Want to change something? Edit messages, photos, or your delivery time until <strong>May 3rd, 11:59pm</strong>:</p>
    <p style="margin-top:8px;"><a href="${escapeHTML(args.editUrl)}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">Edit your messages</a></p>
    <div class="footer">
      <p>Order ${escapeHTML(args.orderId.slice(0, 8))}. Reply if anything looks off — I refund if it sucks.</p>
      <p style="margin-top:14px;font-family:Georgia,serif;color:#9f1239;">#doitforbonnie</p>
      <p style="font-size:11px;color:#9ca3af;font-style:italic;">Built this for my mom Bonnie. Use the tag with yours.</p>
    </div>`;
  return { subject: 'Mother’s Day — confirmed', html: wrap('Confirmed', inner) };
}

export function editClosingReminderEmail(args: { editUrl: string }): { subject: string; html: string } {
  const inner = `
    <h1 style="font-family:-apple-system,system-ui,sans-serif;font-size:22px;margin:0 0 16px;">Last chance to edit</h1>
    <p>Edit window closes tonight at 11:59pm. After that, messages are locked in.</p>
    <p style="margin-top:24px;"><a href="${escapeHTML(args.editUrl)}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">Review &amp; edit</a></p>
    <div class="footer"><p>If everything looks good, ignore this.</p></div>`;
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

// Mother's Day morning email for Tier 3 — links to the Forever Page.
export function foreverPageEmail(args: {
  foreverUrl: string;
  momName?: string;
  userName?: string;
}): { subject: string; html: string } {
  const who = args.momName ? escapeHTML(args.momName) : 'mom';
  const inner = `
    <div style="border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:14px 0;margin-bottom:18px;">
      <div style="color:#15803d;font-size:13px;font-weight:500;">✓ All 7 daily messages sent</div>
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
      She&rsquo;ll open it on her phone. All 7 messages, your photos, the letter, your video — all in one place.
      She can share it with family. She can come back to it forever.
    </p>
    <p style="font-size:14px;color:#6b7280;margin-top:14px;">
      Suggested message: &ldquo;Happy Mother&rsquo;s Day. I made you something. ${escapeHTML(args.foreverUrl)}&rdquo;
    </p>
    <div class="footer">
      <p>That&rsquo;s the whole thing. You did it.<br>— Memphis</p>
    </div>`;
  return {
    subject: `Send this to ${who} — your Mother's Day page is ready`,
    html: wrap('Forever Page ready', inner),
  };
}

// Pre-payment "save my work" email — gives the user a link to come back to
// their unfinished /preview state. Encourages tier upgrades by hinting at media.
export function saveProgressEmail(args: {
  resumeUrl: string;
  momName?: string;
  tier: 1 | 2 | 3;
}): { subject: string; html: string } {
  const who = args.momName ? escapeHTML(args.momName) : 'her';
  const tierAmount = args.tier === 1 ? 19 : args.tier === 2 ? 29 : 49;
  const upgradeLine =
    args.tier === 1
      ? `<p style="font-size:14px;color:#9f1239;margin-top:16px;">
           <strong>P.S.</strong> Want to add photos or a voice memo to a couple days? Bump up to
           the $29 tier — same flow, way more impact. Or stay at $19. No pressure.
         </p>`
      : args.tier === 2
        ? `<p style="font-size:14px;color:#9f1239;margin-top:16px;">
             <strong>P.S.</strong> If you want a private webpage just for ${who} — letter, photos,
             your video, all in one place — that&rsquo;s the $49 tier. You can bump up when you come
             back. Or stay at $29.
           </p>`
        : '';

  const inner = `
    <h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 14px;color:#374151;">
      I&rsquo;m not crying. You&rsquo;re crying.
    </h1>
    <p style="font-size:16px;color:#374151;line-height:1.7;">
      You wrote real things about ${who}. The AI turned them into something good. We saved
      everything you typed so you can come back whenever &mdash; the toilet, your lunch break,
      tonight when the kids are asleep.
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
      In there you can: read your sample messages, add photos or a voice memo,
      tweak anything, then pay $${tierAmount} when you&rsquo;re ready. Edits save automatically.
      Come back as many times as you want.
    </p>
    ${upgradeLine}
    <div class="footer">
      <p>No expiration on this link. We&rsquo;ll be here.<br>— Memphis</p>
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
