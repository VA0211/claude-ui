import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { headers } from "next/headers"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { CVData, CVTemplate } from "@/types/cv"
import { ClassicTemplate } from "@/lib/pdf/templates/classic"
import { ModernTemplate } from "@/lib/pdf/templates/modern"
import { CreativeTemplate } from "@/lib/pdf/templates/creative"
import { registerFonts } from "@/lib/pdf/fonts"

// PDF rendering is server-side in App Router
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const cv = await db.cV.findUnique({ where: { id } })

  if (!cv) {
    return NextResponse.json({ error: "Khong tim thay CV" }, { status: 404 })
  }

  if (cv.userId !== session.user.id) {
    return NextResponse.json({ error: "Khong co quyen" }, { status: 403 })
  }

  // Pro gate: only classic template for free users
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (user?.plan === "FREE" && cv.template !== "classic") {
    return NextResponse.json(
      { error: "Nang cap Pro de su dung mau nay" },
      { status: 403 }
    )
  }

  // Register fonts (no-op if already registered)
  registerFonts()

  const cvData = cv.data as CVData
  const template = cv.template as CVTemplate

  let component: React.ReactElement
  if (template === "modern") {
    component = createElement(ModernTemplate, { data: cvData })
  } else if (template === "creative") {
    component = createElement(CreativeTemplate, { data: cvData })
  } else {
    component = createElement(ClassicTemplate, { data: cvData })
  }

  const buffer = await renderToBuffer(component as React.ReactElement<any>)

  const safeTitle = cv.title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "-")
  const filename = `${safeTitle || "cv"}.pdf`

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length.toString(),
    },
  })
}
