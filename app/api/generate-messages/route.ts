import { NextResponse } from 'next/server';
import { generateContent } from '@/lib/anthropic';
import {
  MESSAGES_SYSTEM_PROMPT,
  generateMessagesPrompt,
  PREVIEW_DAYS_1_2_SYSTEM_PROMPT,
  generatePreviewDays12Prompt,
} from '@/lib/prompts';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const isPreview = body.preview === true;

    const required = ['question_1', 'question_2', 'question_3', 'question_4'];
    for (const key of required) {
      const value = body[key];
      if (typeof value !== 'string' || value.trim().length < 20) {
        return NextResponse.json(
          { error: `${key} must be a string of at least 20 characters` },
          { status: 400 },
        );
      }
    }

    if (isPreview) {
      const messages = await generateContent(
        PREVIEW_DAYS_1_2_SYSTEM_PROMPT,
        generatePreviewDays12Prompt(body),
      );
      if (typeof messages.day_1 !== 'string' || !messages.day_1.length) {
        return NextResponse.json({ error: 'Generated preview missing day_1' }, { status: 500 });
      }
      if (typeof messages.day_2 !== 'string' || !messages.day_2.length) {
        return NextResponse.json({ error: 'Generated preview missing day_2' }, { status: 500 });
      }
      return NextResponse.json({
        messages: { day_1: messages.day_1, day_2: messages.day_2 },
      });
    }

    // Full 7-message generation (used by Stripe webhook after payment).
    const messages = await generateContent(
      MESSAGES_SYSTEM_PROMPT,
      generateMessagesPrompt(body),
    );
    const expectedDays = ['day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'day_6', 'day_7'];
    for (const day of expectedDays) {
      if (typeof messages[day] !== 'string' || messages[day].length === 0) {
        return NextResponse.json(
          { error: `Generated payload missing or empty: ${day}` },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Generate messages error:', error);
    return NextResponse.json(
      { error: 'Failed to generate messages', detail: (error as Error).message },
      { status: 500 },
    );
  }
}
