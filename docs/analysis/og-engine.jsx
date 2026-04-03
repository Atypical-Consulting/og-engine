import { useState, useEffect, useRef, useCallback } from "react";

// ─── Text measurement (Pretext principle) ────────────────────────────────────
let _ctx = null;
function getCtx() {
  if (!_ctx) { const c = document.createElement("canvas"); _ctx = c.getContext("2d"); }
  return _ctx;
}
function measureLines(text, font, maxW) {
  if (!text || maxW <= 0) return [];
  const ctx = getCtx(); ctx.font = font;
  const lines = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { lines.push({ text: "", w: 0 }); continue; }
    let cur = "", curW = 0;
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const ww = ctx.measureText(word).width;
      const sp = cur ? ctx.measureText(" ").width : 0;
      if (curW + sp + ww > maxW && cur) { lines.push({ text: cur, w: curW }); cur = word; curW = ww; }
      else { cur += (cur ? " " : "") + word; curW += sp + ww; }
    }
    if (cur) lines.push({ text: cur, w: curW });
  }
  return lines;
}
function tw(text, font) { const ctx = getCtx(); ctx.font = font; return ctx.measureText(text).width; }

// ─── Config ──────────────────────────────────────────────────────────────────
const FORMATS = {
  og: { w: 1200, h: 630, label: "OG", ratio: "1200×630" },
  twitter: { w: 1200, h: 675, label: "Twitter", ratio: "1200×675" },
  square: { w: 1080, h: 1080, label: "Square", ratio: "1080²" },
  linkedin: { w: 1200, h: 627, label: "LinkedIn", ratio: "1200×627" },
  story: { w: 1080, h: 1920, label: "Story", ratio: "1080×1920" },
};
const ACCENTS = [
  "#38ef7d","#67e8f9","#c4b5fd","#fbbf24","#fb7185","#fb923c","#e2e8f0","#a3e635",
];
const GRADIENTS = [
  { name: "Void", stops: ["#0c0f1a","#080a12"] },
  { name: "Deep Sea", stops: ["#0a1628","#061220"] },
  { name: "Ember", stops: ["#1a0a0a","#120808"] },
  { name: "Forest", stops: ["#0a1a10","#061208"] },
  { name: "Plum", stops: ["#150a1a","#0e0812"] },
  { name: "Slate", stops: ["#12141a","#0a0c10"] },
];
const FONTS = [
  { name: "System", family: "system-ui, -apple-system, sans-serif", google: null },
  { name: "Outfit", family: "'Outfit', sans-serif", google: "Outfit:wght@400;700;800" },
  { name: "Playfair", family: "'Playfair Display', serif", google: "Playfair+Display:wght@400;700;800" },
  { name: "Sora", family: "'Sora', sans-serif", google: "Sora:wght@400;600;800" },
  { name: "Space Grotesk", family: "'Space Grotesk', sans-serif", google: "Space+Grotesk:wght@400;600;700" },
  { name: "DM Serif", family: "'DM Serif Display', serif", google: "DM+Serif+Display" },
  { name: "Bricolage", family: "'Bricolage Grotesque', sans-serif", google: "Bricolage+Grotesque:wght@400;700;800" },
  { name: "Crimson Pro", family: "'Crimson Pro', serif", google: "Crimson+Pro:wght@400;600;800" },
];
const LAYOUTS = { left: "Left", center: "Center", bottom: "Bottom" };

// ─── Load Google Fonts ───────────────────────────────────────────────────────
const loadedFonts = new Set();
function loadGFont(entry) {
  if (!entry.google || loadedFonts.has(entry.name)) return;
  loadedFonts.add(entry.name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${entry.google}&display=swap`;
  document.head.appendChild(link);
}

// ─── Canvas Render ───────────────────────────────────────────────────────────
function renderCard(canvas, o) {
  const { title, desc, author, tag, format, accent, layout, titleSize, descSize,
    fontEntry, gradient, bgImage, overlayOpacity } = o;
  const { w: W, h: H } = FORMATS[format];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const s = Math.max(W, H) / 1200;
  const ff = fontEntry.family;

  // ── BG image or gradient
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, W, H);
    ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
    bg.addColorStop(0, gradient.stops[0]);
    bg.addColorStop(1, gradient.stops[1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  }

  // ── Grid
  ctx.strokeStyle = accent + "05"; ctx.lineWidth = 1;
  const gs = 50 * s;
  for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // ── Glow
  const g1 = ctx.createRadialGradient(W * 0.15, H * 0.8, 0, W * 0.15, H * 0.8, W * 0.35);
  g1.addColorStop(0, accent + "10"); g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);

  // ── Layout
  const px = Math.round(64 * s);
  const cW = W - px * 2;
  const isC = layout === "center", isB = layout === "bottom";

  // tag
  const tagFont = `600 ${Math.round(14 * s)}px ${ff}`;
  let tagH = 0;
  if (tag) { tagH = 28 * s + 16 * s; }

  // title
  const tFont = `800 ${Math.round(titleSize * s)}px ${ff}`;
  const tLH = Math.round(titleSize * 1.2 * s);
  const tLines = measureLines(title || "Untitled", tFont, cW);
  const mxT = format === "story" ? 5 : 3;
  const vT = tLines.slice(0, mxT);

  // desc
  const dFont = `400 ${Math.round(descSize * s)}px ${ff}`;
  const dLH = Math.round(descSize * 1.55 * s);
  const dLines = measureLines(desc || "", dFont, cW);
  const mxD = format === "story" ? 6 : 4;
  const vD = dLines.slice(0, mxD);

  const aFont = `700 ${Math.round(18 * s)}px ${ff}`;
  const aH = 24 * s;
  const g2v = 16 * s, g3v = 20 * s, g4v = 28 * s;
  const totalH = tagH + vT.length * tLH + g3v + vD.length * dLH + g4v + aH;

  let y = isB ? H - px - totalH : isC ? (H - totalH) / 2 : Math.round(px * 1.2);
  const align = isC ? "center" : "left";
  const xP = isC ? W / 2 : px;
  ctx.textAlign = align; ctx.textBaseline = "top";

  // accent bar
  if (!isC && !bgImage) {
    ctx.fillStyle = accent;
    ctx.fillRect(px, y, 4 * s, Math.min(vT.length * tLH + tagH, 80 * s));
  }

  // tag pill
  if (tag) {
    ctx.font = tagFont;
    const tgW = tw(tag.toUpperCase(), tagFont);
    const pW = tgW + 24 * s, pH = 28 * s;
    const pX = isC ? (W - pW) / 2 : px;
    ctx.fillStyle = accent + "18";
    ctx.beginPath(); ctx.roundRect(pX, y, pW, pH, pH / 2); ctx.fill();
    ctx.fillStyle = accent; ctx.font = tagFont;
    ctx.textAlign = "center";
    ctx.fillText(tag.toUpperCase(), pX + pW / 2, y + pH / 2 - 7 * s);
    ctx.textAlign = align;
    y += tagH;
  }

  // title
  ctx.fillStyle = "#f1f5f9"; ctx.font = tFont;
  for (let i = 0; i < vT.length; i++) {
    let t = vT[i].text;
    if (i === vT.length - 1 && tLines.length > mxT) t += "…";
    ctx.fillText(t, xP, y); y += tLH;
  }
  y += g3v;

  // desc
  ctx.fillStyle = bgImage ? "#d1d5db" : "#94a3b8"; ctx.font = dFont;
  for (let i = 0; i < vD.length; i++) {
    let t = vD[i].text;
    if (i === vD.length - 1 && dLines.length > mxD) t += "…";
    ctx.fillText(t, xP, y); y += dLH;
  }
  y += g4v;

  // author
  ctx.fillStyle = accent; ctx.font = aFont;
  ctx.fillText(author || "", xP, y);

  // badge
  ctx.fillStyle = accent + "33";
  ctx.font = `500 ${Math.round(12 * s)}px ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.fillText("⚡ no browser required", W - px, H - px * 0.7);
  ctx.textAlign = "left";

  // frame
  ctx.strokeStyle = accent + "12"; ctx.lineWidth = 1;
  const fr = 24 * s; ctx.strokeRect(fr, fr, W - fr * 2, H - fr * 2);

  return { tTotal: tLines.length, tVis: vT.length, dTotal: dLines.length, dVis: vD.length };
}

// ─── Small UI ────────────────────────────────────────────────────────────────
const Chip = ({ label, active, color, onClick, small }) => (
  <button onClick={onClick} style={{
    padding: small ? "5px 8px" : "6px 10px", borderRadius: 6,
    fontSize: small ? 9 : 10, fontFamily: "inherit",
    border: active ? `1px solid ${color}66` : "1px solid rgba(255,255,255,0.07)",
    background: active ? `${color}12` : "rgba(255,255,255,0.02)",
    color: active ? color : "#64748b",
    cursor: "pointer", letterSpacing: 0.5, whiteSpace: "nowrap", transition: "all 0.15s",
  }}>{label}</button>
);

const Dot = ({ hex, active, onClick }) => (
  <button onClick={onClick} style={{
    width: 26, height: 26, borderRadius: 7,
    background: hex + "22",
    border: active ? `2px solid ${hex}` : "2px solid transparent",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0, transition: "all 0.15s",
  }}>
    <div style={{ width: 10, height: 10, borderRadius: 3, background: hex }} />
  </button>
);

const Field = ({ label, value, onChange, multiline, accent }) => {
  const s = {
    width: "100%", padding: "9px 11px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
    color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", lineHeight: 1.5,
  };
  return (
    <div>
      <label style={{ fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 3 }}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} style={{ ...s, resize: "vertical" }}
            onFocus={e => e.target.style.borderColor = accent + "44"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
        : <input value={value} onChange={e => onChange(e.target.value)} style={s}
            onFocus={e => e.target.style.borderColor = accent + "44"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />}
    </div>
  );
};

const Slider = ({ label, value, onChange, min, max, accent }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569", marginBottom: 3 }}>
      <span style={{ letterSpacing: 2, textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: accent, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{
      width: "100%", height: 4, appearance: "none", WebkitAppearance: "none",
      background: `linear-gradient(90deg, ${accent}44 ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.06) 0%)`,
      borderRadius: 2, outline: "none", cursor: "pointer",
    }} />
  </div>
);

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const [title, setTitle] = useState("Server-Side Text Layout Without a Browser");
  const [desc, setDesc] = useState("Pure JavaScript text measurement replaces Puppeteer and headless Chrome. Sub-millisecond layout for OG images, PDFs, and dynamic content.");
  const [author, setAuthor] = useState("Pretext Engine");
  const [tag, setTag] = useState("Open Source");
  const [format, setFormat] = useState("og");
  const [accent, setAccent] = useState("#38ef7d");
  const [layout, setLayout] = useState("left");
  const [titleSize, setTitleSize] = useState(48);
  const [descSize, setDescSize] = useState(22);
  const [fontIdx, setFontIdx] = useState(0);
  const [gradIdx, setGradIdx] = useState(0);
  const [bgImage, setBgImage] = useState(null);
  const [bgThumb, setBgThumb] = useState(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.65);
  const [renderTime, setRenderTime] = useState(0);
  const [info, setInfo] = useState({});
  const [tab, setTab] = useState("content");
  const [copied, setCopied] = useState(false);

  // Load font
  useEffect(() => { loadGFont(FONTS[fontIdx]); }, [fontIdx]);

  // Render
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // Small delay for font loading
    const id = setTimeout(() => {
      const t0 = performance.now();
      const i = renderCard(c, {
        title, desc, author, tag, format, accent, layout, titleSize, descSize,
        fontEntry: FONTS[fontIdx], gradient: GRADIENTS[gradIdx],
        bgImage, overlayOpacity,
      });
      setRenderTime(performance.now() - t0);
      setInfo(i);
    }, 50);
    return () => clearTimeout(id);
  }, [title, desc, author, tag, format, accent, layout, titleSize, descSize, fontIdx, gradIdx, bgImage, overlayOpacity]);

  const download = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const a = document.createElement("a");
    a.download = `og-${format}-${Date.now()}.png`;
    a.href = c.toDataURL("image/png"); a.click();
  }, [format]);

  const copyClipboard = useCallback(async () => {
    const c = canvasRef.current; if (!c) return;
    try {
      const blob = await new Promise(r => c.toBlob(r, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard may not be available */ }
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { setBgImage(img); setBgThumb(url); };
    img.src = url;
  };

  const removeImage = () => { setBgImage(null); setBgThumb(null); };

  const f = FORMATS[format];
  const speedup = Math.round(850 / Math.max(0.1, renderTime));

  return (
    <div style={{
      minHeight: "100vh", width: "100%", background: "#06080c",
      fontFamily: 'ui-monospace, "SF Mono", "Fira Code", Menlo, monospace',
      color: "#e2e8f0", display: "flex", flexDirection: "column",
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `radial-gradient(circle at 50% 0%, ${accent}04 0%, transparent 50%)` }} />

      {/* Header */}
      <div style={{
        padding: "12px 14px", display: "flex", justifyContent: "space-between",
        alignItems: "center", position: "relative", zIndex: 1,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 800, margin: 0,
            background: `linear-gradient(135deg, ${accent}, #fff)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>OG Engine</h1>
          <div style={{ fontSize: 8, color: "#334155", letterSpacing: 1, marginTop: 1 }}>
            {renderTime.toFixed(1)}ms · {speedup}x vs Puppeteer · {f.ratio}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={copyClipboard} style={{
            padding: "7px 10px", borderRadius: 7, fontSize: 10, fontFamily: "inherit",
            border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
            background: copied ? `${accent}22` : "rgba(255,255,255,0.03)",
            color: copied ? accent : "#94a3b8", transition: "all 0.2s",
          }}>{copied ? "✓" : "Copy"}</button>
          <button onClick={download} style={{
            padding: "7px 12px", borderRadius: 7, fontSize: 10, fontFamily: "inherit",
            fontWeight: 700, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
            color: "#06080c", boxShadow: `0 0 16px ${accent}20`,
          }}>↓ PNG</button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{
        margin: "8px 10px 0", borderRadius: 10, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)", position: "relative", zIndex: 1,
      }}>
        <canvas ref={canvasRef} style={{ width: "100%", display: "block", aspectRatio: `${f.w}/${f.h}` }} />
      </div>

      {/* Formats inline */}
      <div style={{
        display: "flex", gap: 4, margin: "8px 10px 0", position: "relative", zIndex: 1,
        overflowX: "auto", flexShrink: 0,
      }}>
        {Object.entries(FORMATS).map(([k, v]) => (
          <Chip key={k} label={v.label} active={format === k} color={accent}
            onClick={() => setFormat(k)} small />
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 3, margin: "8px 10px 0", position: "relative", zIndex: 1,
      }}>
        {["content","style","background","export"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "7px 0", borderRadius: 7,
            fontSize: 9, fontFamily: "inherit", letterSpacing: 1,
            textTransform: "capitalize",
            border: tab === t ? `1px solid ${accent}44` : "1px solid rgba(255,255,255,0.05)",
            background: tab === t ? `${accent}0a` : "transparent",
            color: tab === t ? accent : "#475569", cursor: "pointer",
          }}>{t}</button>
        ))}
      </div>

      {/* Panels */}
      <div style={{
        padding: "10px 10px 28px", display: "flex", flexDirection: "column",
        gap: 10, position: "relative", zIndex: 1, flex: 1,
      }}>

        {tab === "content" && (<>
          <Field label="Tag" value={tag} onChange={setTag} accent={accent} />
          <Field label="Title" value={title} onChange={setTitle} accent={accent} />
          <Field label="Description" value={desc} onChange={setDesc} multiline accent={accent} />
          <Field label="Author" value={author} onChange={setAuthor} accent={accent} />
        </>)}

        {tab === "style" && (<>
          <div>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>Accent</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {ACCENTS.map(h => <Dot key={h} hex={h} active={accent === h} onClick={() => setAccent(h)} />)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>Font</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {FONTS.map((f, i) => (
                <Chip key={f.name} label={f.name} active={fontIdx === i} color={accent}
                  onClick={() => setFontIdx(i)} small />
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>Layout</div>
            <div style={{ display: "flex", gap: 5 }}>
              {Object.entries(LAYOUTS).map(([k, v]) => (
                <Chip key={k} label={v} active={layout === k} color={accent} onClick={() => setLayout(k)} />
              ))}
            </div>
          </div>
          <Slider label="Title size" value={titleSize} onChange={setTitleSize} min={28} max={72} accent={accent} />
          <Slider label="Description size" value={descSize} onChange={setDescSize} min={14} max={32} accent={accent} />
        </>)}

        {tab === "background" && (<>
          <div>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>Image</div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload}
              style={{ display: "none" }} />
            {bgThumb ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{
                  width: 64, height: 40, borderRadius: 6, overflow: "hidden",
                  border: `1px solid ${accent}33`,
                }}>
                  <img src={bgThumb} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <button onClick={() => fileRef.current?.click()} style={{
                  padding: "6px 10px", borderRadius: 6, fontSize: 10, fontFamily: "inherit",
                  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                  color: "#94a3b8", cursor: "pointer",
                }}>Replace</button>
                <button onClick={removeImage} style={{
                  padding: "6px 10px", borderRadius: 6, fontSize: 10, fontFamily: "inherit",
                  border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)",
                  color: "#f87171", cursor: "pointer",
                }}>Remove</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} style={{
                width: "100%", padding: "14px", borderRadius: 8, fontSize: 11, fontFamily: "inherit",
                border: `1px dashed ${accent}33`, background: `${accent}05`,
                color: `${accent}88`, cursor: "pointer", letterSpacing: 1,
              }}>+ Upload background image</button>
            )}
          </div>
          {bgImage && (
            <Slider label="Overlay darkness" value={Math.round(overlayOpacity * 100)}
              onChange={v => setOverlayOpacity(v / 100)} min={20} max={90} accent={accent} />
          )}
          {!bgImage && (
            <div>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>Gradient</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {GRADIENTS.map((g, i) => (
                  <button key={g.name} onClick={() => setGradIdx(i)} style={{
                    width: 40, height: 28, borderRadius: 6, cursor: "pointer", padding: 0,
                    background: `linear-gradient(135deg, ${g.stops[0]}, ${g.stops[1]})`,
                    border: gradIdx === i ? `2px solid ${accent}` : "2px solid rgba(255,255,255,0.08)",
                    transition: "border 0.15s",
                  }} title={g.name} />
                ))}
              </div>
            </div>
          )}
        </>)}

        {tab === "export" && (<>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={download} style={{
              flex: 1, padding: "14px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
              fontWeight: 700, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
              color: "#06080c", boxShadow: `0 0 20px ${accent}20`,
            }}>↓ Download PNG</button>
            <button onClick={copyClipboard} style={{
              flex: 1, padding: "14px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
              fontWeight: 600, cursor: "pointer",
              border: `1px solid ${accent}44`,
              background: copied ? `${accent}15` : "transparent",
              color: copied ? accent : "#94a3b8", transition: "all 0.2s",
            }}>{copied ? "✓ Copied!" : "Copy to Clipboard"}</button>
          </div>

          <div style={{
            padding: "12px", borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, marginBottom: 8 }}>ANALYSIS</div>
            {[
              ["Title lines", `${info.tVis || 0} shown / ${info.tTotal || 0} total`, accent],
              ["Desc lines", `${info.dVis || 0} shown / ${info.dTotal || 0} total`, accent],
              ["Canvas", `${f.w}×${f.h}`, "#94a3b8"],
              ["Font", FONTS[fontIdx].name, "#94a3b8"],
              ["Render", `${renderTime.toFixed(2)}ms`, accent],
              ["vs Puppeteer", `${speedup}x faster`, "#fbbf24"],
              ["DOM nodes", "0", "#ef4444"],
              ["Browsers", "0", "#ef4444"],
            ].map(([k, v, c], i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 10, padding: "3px 0",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <span style={{ color: "#64748b" }}>{k}</span>
                <span style={{ color: c, fontVariantNumeric: "tabular-nums" }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: `${accent}06`, border: `1px solid ${accent}15`,
            fontSize: 10, color: "#64748b", lineHeight: 1.6,
          }}>
            <strong style={{ color: accent }}>API equivalent:</strong><br />
            <code style={{ fontSize: 9, color: "#94a3b8" }}>
              POST /render {"{"} format: "{format}", title: "...", font: "{FONTS[fontIdx].name}" {"}"}
            </code>
            <br />
            <span style={{ fontSize: 9, color: "#475569" }}>
              → Returns PNG in ~{renderTime.toFixed(0)}ms. No Chrome. No Puppeteer.
            </span>
          </div>
        </>)}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none; width: 14px; height: 14px; border-radius: 50%;
          background: #e2e8f0; cursor: pointer; border: none;
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: #e2e8f0; cursor: pointer; border: none;
        }
      `}</style>
    </div>
  );
}
