// Optional contribution endpoint. The product is free; this is for users who
// already finished and want to throw money at it after the fact.
// Creates a Stripe checkout session marked with metadata.contribution=true so
// the webhook knows it shouldn't re-schedule emails or re-process the order.

import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = typeof body.orderId === 'string' && body.orderId ? body.orderId : null;
    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: 'amount must be at least $1' }, { status: 400 });
    }
    const amountCents = Math.round(amount * 100);

    if (orderId) {
      // Order-attached contribution. Only allowed post-success.
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id,user_email,paid')
        .eq('id', orderId)
        .maybeSingle();
      if (!order) {
        return NextResponse.json({ error: 'order not found' }, { status: 404 });
      }
      if (!order.paid) {
        return NextResponse.json({ error: 'order not finalized yet' }, { status: 400 });
      }
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: "Mother's Day Messages — contribution",
                description: 'Voluntary support. The product is free.',
              },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_URL}/success?orderId=${order.id}&contributed=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_URL}/success?orderId=${order.id}`,
        client_reference_id: order.id,
        customer_email: order.user_email,
        metadata: { order_id: order.id, contribution: 'true' },
      });
      return NextResponse.json({ url: session.url });
    }

    // Standalone tip — no order. Webhook records to analytics_events.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: "Mother's Day Messages — tip jar",
              description: 'Voluntary support. The product is free.',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/?tipped=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/`,
      metadata: { standalone_tip: 'true' },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('contribute error', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
