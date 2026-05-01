import Stripe from 'stripe';

// Omit apiVersion → Stripe uses the version pinned to the account.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PRODUCT_NAME = "Mother's Day Messages";
const PRODUCT_DESCRIPTION = '3 messages, 2 photos, 1 forever page. We email you each morning May 8–10. You copy, paste, send to mom.';

export async function createCheckoutSession(args: {
  orderId: string;
  amountCents: number; // dollars × 100
  email: string;
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: PRODUCT_NAME, description: PRODUCT_DESCRIPTION },
          unit_amount: args.amountCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/preview`,
    client_reference_id: args.orderId,
    customer_email: args.email,
    metadata: { order_id: args.orderId },
  });
  return session;
}
