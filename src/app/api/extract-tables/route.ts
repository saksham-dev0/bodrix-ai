import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      return NextResponse.json(
        { error: 'OpenAI API key not configured', tables: [] },
        { status: 200 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a table extraction expert. Extract all tables from the given text and return them as a JSON array. Each table should have a 'rows' array where the first row contains headers and subsequent rows contain data. Return ONLY valid JSON, no additional text."
          },
          {
            role: "user",
            content: `Extract all tables from this text and return as JSON in this exact format: [{"page": 1, "rows": [["Header1", "Header2"], ["data1", "data2"]]}]\n\nText:\n${text.substring(0, 8000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status, await response.text());
      return NextResponse.json(
        { error: 'OpenAI API error', tables: [] },
        { status: 200 }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "[]";
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7, -3).trim();
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3, -3).trim();
    }
    
    const tables = JSON.parse(jsonStr);
    console.log("AI extracted tables:", tables);
    
    return NextResponse.json({
      tables: Array.isArray(tables) ? tables : [],
    });
  } catch (error) {
    console.error("Error in table extraction:", error);
    return NextResponse.json(
      { error: 'Internal error', tables: [] },
      { status: 200 }
    );
  }
}

