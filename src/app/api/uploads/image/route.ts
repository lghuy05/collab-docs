import { NextResponse } from "next/server";
import { createImageUploadUrl } from '@/utils/s3';

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { contentType, documentId } = await req.json();

    if (!contentType?.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image uploads allowed" },
        { status: 400 }
      );
    }
    const ext = contentType.split("/")[1] ?? "png";
    const fileName = crypto.randomUUID() + "." + ext;
    const key = `images/public/documents/${documentId}/${fileName}`;
    const uploadUrl = await createImageUploadUrl({
      key,
      contentType,
    });

    const publicUrl =
      `${process.env.PUBLIC_S3_BASE_URL}/${key}`;
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
