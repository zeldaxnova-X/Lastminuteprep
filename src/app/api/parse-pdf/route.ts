/* eslint-disable @typescript-eslint/no-require-imports */
import { NextResponse } from "next/server";
import { parseSscCglPdfText } from "@/lib/pdf-parser/ssc-cgl-parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No PDF file provided in formData." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";

    try {
      // Dynamic import of pdf-parse for Next.js App Router API environment
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || "";
    } catch (e) {
      console.warn("pdf-parse extraction warning, applying text stream reader fallback:", e);
      // Fallback decoding if pdf-parse encounters standard buffer stream formatting
      extractedText = buffer.toString("utf-8");
    }

    const questions = parseSscCglPdfText(extractedText);

    return NextResponse.json({
      success: true,
      total_extracted: questions.length,
      questions,
    });
  } catch (error: unknown) {
    console.error("PDF Parsing API Error:", error);
    const errMessage = error instanceof Error ? error.message : "Failed to process and extract questions from PDF.";
    return NextResponse.json(
      {
        success: false,
        error: errMessage,
      },
      { status: 500 }
    );
  }
}
