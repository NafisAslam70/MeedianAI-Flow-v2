import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req) {
  try {
    const { title, description = "" } = await req.json();

    if (!title) {
      return NextResponse.json({ success: false, error: "Missing title field." }, { status: 400 });
    }

    const prompt = `
Translate the following Hindi inputs to English and return only a JSON object like:
{
  "title": "<translated title>",
  "description": "<translated description>"
}

Hindi Title: ${title}
Hindi Description: ${description}
    `.trim();

    const response = await axios.post(
      `${process.env.DEEPSEEK_API_BASE}/chat/completions`,
      {
        model: "deepseek-chat", // or deepseek-coder depending on availability
        messages: [
          { role: "system", content: "You are a helpful translation assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4,
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let output = response.data.choices[0].message.content.trim();
    output = output.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch {
      return NextResponse.json({
        success: false,
        error: "DeepSeek response is not valid JSON.",
        raw: output
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      provider: "deepseek",
      translatedTitle: parsed.title,
      translatedDescription: parsed.description,
    });

  } catch (err) {
    console.error("🚨 DeepSeek API error:", err.response?.data || err.message);
    return NextResponse.json({
      success: false,
      error: err.response?.data?.error?.message || err.message
    }, { status: 500 });
  }
}
