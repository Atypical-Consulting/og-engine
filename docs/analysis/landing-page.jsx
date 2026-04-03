import { useState, useEffect, useRef } from "react";

const ACCENT = "#38ef7d";

function Counter({ target, suffix, duration = 1200 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const start = performance.now();
        const tick = () => {
          const p = Math.min(1, (performance.now() - start) / duration);
          setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

function Section({ children, id, style = {} }) {
  return <section id={id} style={{ padding: "48px 20px", maxWidth: 480, margin: "0 auto", position: "relative", ...style }}>{children}</section>;
}
function Label({ children }) {
  return <div style={{ fontSize: 9, letterSpacing: 5, textTransform: "uppercase", color: ACCENT, opacity: 0.6, marginBottom: 10 }}>{children}</div>;
}
function H2({ children }) {
  return <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 12px", color: "#f1f5f9", lineHeight: 1.2, letterSpacing: -0.3 }}>{children}</h2>;
}

function Code({ children, lang }) {
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", marginTop: 12 }}>
      {lang && <div style={{ padding: "6px 12px", fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)", letterSpacing: 1 }}>{lang}</div>}
      <pre style={{ margin: 0, padding: 14, fontSize: 11, lineHeight: 1.6, color: "#94a3b8", overflowX: "auto", background: "rgba(255,255,255,0.015)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}><code>{children}</code></pre>
    </div>
  );
}

function PricingCard({ name, price, calls, features, cta, popular, color }) {
  return (
    <div style={{ padding: popular ? 2 : 0, borderRadius: 16, background: popular ? `linear-gradient(135deg, ${color}44, ${color}11)` : "transparent" }}>
      <div style={{ padding: "24px 20px", borderRadius: popular ? 14 : 16, background: popular ? "#0c0f1a" : "rgba(255,255,255,0.02)", border: popular ? "none" : "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
        {popular && <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", fontSize: 8, letterSpacing: 3, textTransform: "uppercase", padding: "3px 12px", borderRadius: 10, background: color, color: "#06080c", fontWeight: 700 }}>POPULAIRE</div>}
        <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{name}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: "#f1f5f9" }}>{price}</span>
          <span style={{ fontSize: 13, color: "#475569" }}>/mois</span>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 16 }}>{calls}</div>
        {features.map((f, i) => (
          <div key={i} style={{ fontSize: 11, color: "#94a3b8", padding: "4px 0", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color, fontSize: 11, flexShrink: 0 }}>✓</span><span>{f}</span>
          </div>
        ))}
        <button style={{
          width: "100%", marginTop: 18, padding: "12px", borderRadius: 10, fontSize: 12, fontFamily: "inherit",
          fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
          border: popular ? "none" : `1px solid ${color}44`,
          background: popular ? `linear-gradient(135deg, ${color}, ${color}bb)` : "transparent",
          color: popular ? "#06080c" : color,
          boxShadow: popular ? `0 0 24px ${color}22` : "none",
        }}>{cta}</button>
      </div>
    </div>
  );
}

function FAQ({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "14px 0" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
        <span style={{ fontSize: 13, color: "#e2e8f0", textAlign: "left", fontWeight: 600 }}>{q}</span>
        <span style={{ color: ACCENT, fontSize: 16, flexShrink: 0, marginLeft: 12, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginTop: 8 }}>{a}</div>}
    </div>
  );
}

const CURL_EXAMPLE = `curl -X POST https://api.og-engine.com/render \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "format": "og",
    "title": "Mon article de blog",
    "description": "Une description captivante.",
    "author": "Mon Entreprise",
    "style": {
      "accent": "#38ef7d",
      "font": "Outfit"
    }
  }' --output og-image.png`;

const RESPONSE_EXAMPLE = `HTTP/1.1 200 OK
Content-Type: image/png
X-Render-Time-Ms: 2.34
X-Title-Lines: 1
X-Layout-Overflow: false

[binary PNG — 42kb]`;

const JS_EXAMPLE = `const og = new OGEngine("YOUR_API_KEY")

const image = await og.render({
  format: "og",
  title: post.title,
  description: post.excerpt,
  author: post.author,
  style: { accent: "#38ef7d", font: "Outfit" }
})

await Bun.write("og.png", image)`;

const NEXTJS_EXAMPLE = `// app/api/og/[slug]/route.ts
export async function GET(req, { params }) {
  const post = await getPost(params.slug)

  const res = await fetch(
    "https://api.og-engine.com/render",
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        format: "og",
        title: post.title,
        description: post.excerpt
      })
    }
  )

  return new Response(res.body, {
    headers: { "Content-Type": "image/png" }
  })
}`;

export default function App() {
  return (
    <div style={{
      minHeight: "100vh", width: "100%", background: "#06080c",
      fontFamily: 'ui-monospace, "SF Mono", "Fira Code", Menlo, monospace',
      color: "#e2e8f0", overflowX: "hidden",
    }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", backgroundImage: `radial-gradient(circle at 30% 10%, ${ACCENT}06 0%, transparent 40%), radial-gradient(circle at 70% 90%, #c4b5fd04 0%, transparent 40%)` }} />

      {/* HERO */}
      <Section style={{ paddingTop: 56, paddingBottom: 32, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: `${ACCENT}0a`, border: `1px solid ${ACCENT}22`, fontSize: 10, color: ACCENT, marginBottom: 16, letterSpacing: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 8px ${ACCENT}`, display: "inline-block" }} />
          API disponible
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, margin: "0 0 14px", letterSpacing: -0.5, background: `linear-gradient(135deg, ${ACCENT} 0%, #67e8f9 50%, #c4b5fd 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Générez des images<br />sans navigateur.
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 24px" }}>
          Une API qui remplace Puppeteer pour créer des images OG, bannières et visuels dynamiques.
          <strong style={{ color: "#e2e8f0" }}> 500x plus rapide. Zéro Chrome.</strong>
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#pricing" style={{ padding: "12px 24px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}bb)`, color: "#06080c", textDecoration: "none", boxShadow: `0 0 28px ${ACCENT}22` }}>Obtenir ma clé API</a>
          <a href="#demo" style={{ padding: "12px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", textDecoration: "none", background: "transparent" }}>Voir la démo →</a>
        </div>
      </Section>

      {/* STATS */}
      <div style={{ display: "flex", justifyContent: "center", gap: 24, padding: "20px 20px", borderTop: "1px solid rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        {[{ val: 500, suffix: "x", label: "plus rapide" }, { val: 2, suffix: "ms", label: "par image" }, { val: 0, suffix: "", label: "navigateur" }].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}><Counter target={s.val} suffix={s.suffix} /></div>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* HOW IT WORKS */}
      <Section id="demo">
        <Label>Comment ça marche</Label>
        <H2>Un POST, une image.</H2>
        <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, margin: "0 0 4px" }}>
          Envoyez votre contenu en JSON, recevez un PNG en retour. Pas de Chrome, pas de Puppeteer.
        </p>
        <Code lang="REQUÊTE">{CURL_EXAMPLE}</Code>
        <Code lang="RÉPONSE">{RESPONSE_EXAMPLE}</Code>
      </Section>

      {/* USE CASES */}
      <Section>
        <Label>Cas d'usage</Label>
        <H2>Remplacez votre infra.</H2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {[
            { icon: "🔗", title: "Images OG / Social Cards", desc: "Générez une miniature unique pour chaque page. SEO et partage optimisés." },
            { icon: "📧", title: "Bannières email dynamiques", desc: "Images personnalisées par destinataire. Prénom, offre, date — à la volée." },
            { icon: "🛒", title: "E-commerce", desc: "Visuels produits avec prix et badges promo. Le texte s'adapte toujours." },
            { icon: "✅", title: "Validation de texte", desc: "Endpoint /validate : vérifiez si votre copie tient dans un format. Gratuit et illimité." },
          ].map((c, i) => (
            <div key={i} style={{ padding: "16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* COMPARISON */}
      <Section>
        <Label>Comparaison</Label>
        <H2>Puppeteer vs OG Engine</H2>
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", marginTop: 8 }}>
          {[
            ["", "Puppeteer", "OG Engine"],
            ["Rendu", "~850ms", "~2ms"],
            ["Mémoire", "300-500MB", "~10MB"],
            ["Concurrence", "5-10/inst.", "500+/inst."],
            ["Cold start", "2-5 sec", "50ms"],
            ["Infra", "Chrome+Xvfb", "Node.js"],
            ["Coût", "€€€", "€"],
          ].map((row, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: i === 0 ? 9 : 11, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#475569" : "#94a3b8", letterSpacing: i === 0 ? 1 : 0, textTransform: i === 0 ? "uppercase" : "none", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              {row.map((cell, j) => (
                <div key={j} style={{ padding: "10px 10px", color: j === 2 && i > 0 ? ACCENT : j === 1 && i > 0 ? "#ef4444" : undefined, fontWeight: j === 0 ? 600 : 400, background: j === 2 && i > 0 ? `${ACCENT}05` : "transparent" }}>{cell}</div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* PRICING */}
      <Section id="pricing">
        <Label>Tarifs</Label>
        <H2>Simple. Prévisible.</H2>
        <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, margin: "0 0 16px" }}>
          Pas de frais cachés. Pas d'engagement.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PricingCard name="Free" price="0€" calls="500 appels/mois" color="#64748b"
            features={["500 appels/mois", "Formats OG + Twitter", "3 templates", "PNG uniquement"]}
            cta="Commencer gratuitement" />
          <PricingCard name="Starter" price="10€" calls="10 000 appels/mois" color={ACCENT} popular
            features={["10 000 appels/mois", "Tous les formats", "Tous les templates", "PNG + WebP", "Google Fonts (20+)", "Background images", "Support email"]}
            cta="Choisir Starter →" />
          <PricingCard name="Pro" price="39€" calls="50 000 appels/mois" color="#67e8f9"
            features={["50 000 appels/mois", "Tout du Starter", "Batch (100 images/requête)", "Cache CDN inclus", "Webhook régénération", "Support prioritaire"]}
            cta="Choisir Pro →" />
          <PricingCard name="Scale" price="99€" calls="200 000 appels/mois" color="#c4b5fd"
            features={["200 000 appels/mois", "Tout du Pro", "Templates custom (JSON)", "SLA 99.9%", "Slack dédié", "Annuel -20%"]}
            cta="Choisir Scale →" />
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "#475569" }}>
          Besoin de plus ? <span style={{ color: ACCENT }}>Contactez-nous</span>
          <br /><span style={{ fontSize: 10, color: "#334155" }}>L'endpoint /validate est gratuit et illimité.</span>
        </div>
      </Section>

      {/* INTEGRATION */}
      <Section>
        <Label>Intégration</Label>
        <H2>5 minutes pour intégrer.</H2>
        <Code lang="SDK — TYPESCRIPT">{JS_EXAMPLE}</Code>
        <Code lang="NEXT.JS — API ROUTE">{NEXTJS_EXAMPLE}</Code>
      </Section>

      {/* FAQ */}
      <Section>
        <Label>Questions</Label>
        <H2>FAQ</H2>
        <div style={{ marginTop: 8 }}>
          <FAQ q="Comment ça peut être aussi rapide ?" a="On utilise Pretext, un moteur qui calcule les dimensions exactes du texte sans DOM ni navigateur. De l'arithmétique pure sur des largeurs de glyphes mesurées par Canvas." />
          <FAQ q="Les polices sont-elles fidèles ?" a="Oui. On embarque les fichiers Google Fonts sur nos serveurs. Le rendu est identique à un navigateur." />
          <FAQ q="Quels langages sont supportés ?" a="Tous. Arabe, chinois, japonais, coréen, emojis, texte mixte bidirectionnel." />
          <FAQ q="L'endpoint /validate est vraiment gratuit ?" a="Oui, illimité. Il vérifie si votre texte tient dans le format sans générer d'image." />
          <FAQ q="Templates custom ?" a="Sur le plan Scale, vous définissez un template en JSON et le référencez dans vos appels." />
          <FAQ q="Disponibilité ?" a="Containers auto-scalés. Plan Scale = SLA 99.9%." />
        </div>
      </Section>

      {/* CTA */}
      <Section style={{ textAlign: "center", paddingBottom: 64 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px", background: `linear-gradient(135deg, ${ACCENT}, #67e8f9)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Prêt à tuer Puppeteer ?
        </h2>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px" }}>500 appels gratuits. Aucune carte requise.</p>
        <a href="#pricing" style={{ display: "inline-block", padding: "14px 32px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}bb)`, color: "#06080c", textDecoration: "none", boxShadow: `0 0 32px ${ACCENT}25` }}>
          Créer mon compte gratuitement
        </a>
      </Section>

      <div style={{ padding: "20px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 10, color: "#1e293b" }}>
        OG Engine · Propulsé par Pretext · 2026
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        a { transition: opacity 0.15s; }
        a:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}
