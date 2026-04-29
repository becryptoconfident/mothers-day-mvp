import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { signEditToken } from '@/lib/auth';
import { sendEmail } from '@/lib/resend';
import { magicLinkEmail } from '@/lib/email-templates';

export async function POST(req: Request) {
  try {
    const { orderId, email } = await req.json();
    if (!orderId || !email) {
      return NextResponse.json({ error: 'orderId and email required' }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id,user_email')
      .eq('id', orderId)
      .maybeSingle();

    // Always return success to avoid email enumeration. Only send if matched.
    if (order && order.user_email.toLowerCase() === String(email).toLowerCase()) {
      const token = signEditToken(order.id);
      const editUrl = `${process.env.NEXT_PUBLIC_URL}/edit/${order.id}#t=${token}`;
      const tpl = magicLinkEmail({ editUrl });
      await sendEmail({
        to: order.user_email,
        subject: tpl.subject,
        html: tpl.html,
        tag: 'magic-link',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
