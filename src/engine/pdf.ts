/**
 * Minimal PDF builder — embeds a PNG image in a single-page PDF.
 * Zero dependencies. Produces valid PDF 1.4 files.
 */
export function buildPdf(pngBuffer: Buffer, width: number, height: number): Buffer {
  // Convert pixel dimensions to PDF points (72 dpi)
  // OG images are typically displayed at screen resolution; use 1:1 pixel-to-point
  const pageW = width;
  const pageH = height;

  const _pngB64 = pngBuffer.toString('base64');

  // PDF objects
  const objects: string[] = [];
  const offsets: number[] = [];

  function addObj(content: string): number {
    const num = objects.length + 1;
    objects.push(content);
    return num;
  }

  // 1: Catalog
  const pagesRef = 2;
  addObj(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

  // 2: Pages
  const pageRef = 3;
  addObj(`<< /Type /Pages /Kids [${pageRef} 0 R] /Count 1 >>`);

  // 3: Page
  const contentsRef = 4;
  const resourcesRef = 5;
  addObj(
    `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentsRef} 0 R /Resources ${resourcesRef} 0 R >>`,
  );

  // 4: Contents (draw image full-page)
  const contentStream = `q ${pageW} 0 0 ${pageH} 0 0 cm /Img Do Q`;
  addObj(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`);

  // 5: Resources
  const imgRef = 6;
  addObj(`<< /XObject << /Img ${imgRef} 0 R >> >>`);

  // 6: Image XObject (PNG embedded via FlateDecode of raw stream, or as-is with DCT)
  // For simplicity and correctness, embed the PNG directly using the /Filter approach
  // PDF supports embedding PNG data via /FlateDecode with /DecodeParms for Predictor
  // But the simplest correct approach: embed as raw RGB pixels
  // Actually, the cleanest no-dep approach: use ASCII85 or raw hex. Let's use raw binary.

  // PNG-in-PDF: We'll reference the PNG as an inline image in content stream.
  // Better approach: embed PNG bytes as the image stream with proper filter chain.
  // Simplest valid approach: embed the raw PNG buffer with proper PDF image XObject headers.

  // Use FlateDecode — PNG data minus the header can be used if we strip correctly.
  // But that's complex. Instead, just embed the full PNG buffer and let PDF readers handle it.
  // Wait — PDF doesn't natively understand PNG containers. We need to extract raw image data.

  // Simplest correct approach for zero-dep: embed as uncompressed RGB from canvas.
  // But we only have PNG buffer. Let's decode PNG minimally or use a different strategy.

  // Actually the cleanest approach: create the image XObject using the PNG's compressed
  // IDAT chunks with FlateDecode + PNG predictor params. But parsing PNG is non-trivial.

  // Pragmatic solution: encode PNG buffer as hex stream with /ASCIIHexDecode then
  // reference it as an opaque XObject. BUT PDF image XObjects need pixel data, not PNG.

  // Final approach: Use the PNG as a raw byte stream embedded directly.
  // The trick: We can use /Filter [/ASCIIHexDecode /FlateDecode] with PNG predictor,
  // but we need to strip the PNG container.

  // OK - simplest correct implementation: create a proper PDF by extracting
  // the raw compressed data from the PNG and setting up proper DecodeParms.
  const pngData = extractPngIDAT(pngBuffer);

  const imgDict = [
    `/Type /XObject`,
    `/Subtype /Image`,
    `/Width ${width}`,
    `/Height ${height}`,
    `/ColorSpace /DeviceRGB`,
    `/BitsPerComponent 8`,
    `/Filter /FlateDecode`,
    `/DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${width} >>`,
    `/Length ${pngData.length}`,
  ].join(' ');

  // Build PDF manually to control byte offsets
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';

  // Write objects 1-5
  for (let i = 0; i < 5; i++) {
    offsets[i] = pdf.length;
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  // Write image object (6) — binary data, need Buffer concat
  const imgHeaderStr = `6 0 obj\n<< ${imgDict} >>\nstream\n`;
  const imgFooterStr = '\nendstream\nendobj\n';

  const pdfHeader = Buffer.from(pdf, 'binary');
  const imgHeader = Buffer.from(imgHeaderStr, 'binary');
  const imgFooter = Buffer.from(imgFooterStr, 'binary');

  offsets[5] = pdfHeader.length;

  // Cross-reference table
  const xrefOffset = pdfHeader.length + imgHeader.length + pngData.length + imgFooter.length;

  let xref = 'xref\n';
  xref += `0 7\n`;
  xref += `0000000000 65535 f \n`;
  for (let i = 0; i < 6; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  let trailer = 'trailer\n';
  trailer += `<< /Size 7 /Root 1 0 R >>\n`;
  trailer += 'startxref\n';
  trailer += `${xrefOffset}\n`;
  trailer += '%%EOF\n';

  const xrefBuf = Buffer.from(xref + trailer, 'binary');

  return Buffer.concat([pdfHeader, imgHeader, pngData, imgFooter, xrefBuf]);
}

/**
 * Extract concatenated IDAT chunk data from a PNG buffer.
 * This gives us the raw zlib-compressed image data that PDF can use
 * with /FlateDecode and PNG predictor parameters.
 */
function extractPngIDAT(png: Buffer): Buffer {
  // PNG structure: 8-byte signature, then chunks (length + type + data + crc)
  const chunks: Buffer[] = [];
  let offset = 8; // Skip PNG signature

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.slice(offset + 4, offset + 8).toString('ascii');

    if (type === 'IDAT') {
      chunks.push(png.slice(offset + 8, offset + 8 + length));
    }

    offset += 12 + length; // 4 (length) + 4 (type) + data + 4 (crc)
  }

  return Buffer.concat(chunks);
}
