import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file || file.type !== "application/pdf") {
            return NextResponse.json({ error: "Invalid file. Please upload a PDF." }, { status: 400 });
        }

        // Convert the PDF to a base64 string
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: "application/pdf"
                            }
                        },
                        {
                            text: "Extract the complete text of this research paper and convert it into highly readable Markdown. Preserve all statistics, quotes, headings, and data accurately. Remove any page numbers, headers, footers, or irrelevant publishing stamps. Do not include introductory conversational text, just output the raw Markdown."
                        }
                    ]
                }
            ]
        });

        let markdown = response.text || "";

        // Clean up markdown block wrapping if Gemini includes it
        if (markdown.startsWith("```markdown")) {
            markdown = markdown.replace(/^```markdown\n/, "").replace(/\n```$/, "");
        } else if (markdown.startsWith("```")) {
            markdown = markdown.replace(/^```\n/, "").replace(/\n```$/, "");
        }

        return NextResponse.json({ markdown: markdown.trim() });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("PDF Parsing Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
