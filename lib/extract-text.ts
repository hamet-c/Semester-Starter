import mammoth from "mammoth";

/**
 * Extract plain text from an uploaded syllabus file.
 * Supports .pdf, .docx, and plain text (.txt/.md).
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf") {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    // Rebuild line breaks from each text item's Y position — unpdf's plain
    // extractText merges a whole page into one line, which breaks the
    // line-based rule parser.
    let out = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      let line = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5] as number;
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          out += line.trimEnd() + "\n";
          line = "";
        }
        line += item.str + " ";
        lastY = y;
      }
      out += line.trimEnd() + "\n";
    }
    return out;
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === "doc") {
    throw new Error(
      "Legacy .doc files aren't supported — please re-save the syllabus as .docx or PDF."
    );
  }

  // .txt, .md, or anything else: treat as UTF-8 text
  return buffer.toString("utf-8");
}
