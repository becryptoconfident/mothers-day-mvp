# mothers-day-mvp

Free Mother's Day tool. Answer 4 questions about your mom in 5 minutes. Walk away with 3 personalized messages and a private forever page — photos, a letter, her name on it — that stays online for a full year.

**Live:** [mothers-day-mvp.vercel.app](https://mothers-day-mvp.vercel.app)

## What it does

- 4-question flow → AI writes 3 messages for you (one each morning May 8th–10th)
- Delivers them to your inbox to copy and text, or sends directly to mom with you CC'd
- Generates a private forever page: photos, AI-written letter, all 3 messages
- Fully free. Optional contribution supported via Stripe.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL) |
| Email | Resend (scheduled delivery, BCC, reply-to) |
| Payments | Stripe Checkout |
| Media | Cloudflare R2 (presigned uploads) |
| AI | Anthropic Claude (message + letter generation) |
| Deploy | Vercel |

## License

MIT
