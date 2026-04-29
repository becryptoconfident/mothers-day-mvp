import Stripe from 'stripe';

// Omit apiVersion → Stripe uses the version pinned to the account.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export type Tier = 1 | 2 | 3;

export const TIER_PRICING: Record<Tier, { amount: number; name: string; description: string }> = {
  1: {
    amount: 1900,
    name: 'Mother Lover Package',
    description: 'A few prompts → AI writes a week of small notes → we email you one each morning May 4th–10th. You copy, paste, send. She thinks you’ve been planning since February.',
  },
  2: {
    amount: 2900,
    name: 'Mother Lover Package + Feels',
    description: 'Everything above, plus your own photos, video, or voice memos on 2–3 days. The days she pauses because yours showed up.',
  },
  3: {
    amount: 4900,
    name: 'Mother Lover Package + Feels + Forever Page',
    description: 'Everything above, plus a private webpage just for her — all 7 messages, your photos, an AI-written letter, optional video. Lives forever. She can share it with family.',
  },
};

export async function createCheckoutSession(args: {
  orderId: string;
  tier: Tier;
  email: string;
}) {
  const pricing = TIER_PRICING[args.tier];
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: pricing.name, description: pricing.description },
          unit_amount: pricing.amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/preview`,
    client_reference_id: args.orderId,
    customer_email: args.email,
    metadata: { order_id: args.orderId, tier: String(args.tier) },
  });
  return session;
}
