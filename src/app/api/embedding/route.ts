import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Valid text is required' }, { status: 400 })
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    })

    const embedding = response.data[0].embedding

    return NextResponse.json({ embedding })
  } catch (error) {
    console.error('Error creating embedding:', error)
    return NextResponse.json({ error: 'Failed to create embedding' }, { status: 500 })
  }
}