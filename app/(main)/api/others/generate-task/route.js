import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ success: false, error: "Invalid input: Missing text" }, { status: 400 });
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000", // Optional: Your site URL
          "X-Title": "AssignTask", // Optional: Your site name
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat:free",
          messages: [
            {
              role: "user",
              content: `Given the following task description in any language: "${text}", generate a concise English title (up to 10 words) and a detailed English description (up to 100 words) for a task. Return the result as a JSON object with fields "title" and "description".`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const { choices } = await response.json();
      const generated = JSON.parse(choices[0].message.content);

      return NextResponse.json({
        success: true,
        title: generated.title,
        description: generated.description,
      });
    } catch (error) {
      console.error("DeepSeek API error:", error);
      return NextResponse.json({ success: false, error: `Task generation failed: ${error.message}` }, { status: 500 });
    }
  } catch (error) {
    console.error("Request parsing error:", error);
    return NextResponse.json({ success: false, error: "Invalid request: Malformed JSON or missing fields" }, { status: 400 });
  }
}