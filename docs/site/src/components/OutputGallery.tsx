import { useEffect, useRef, useState } from 'react';
import { renderCard } from './engine/canvas-renderer';
import { GRADIENTS, ACCENTS } from './engine/gradients';
import { FONTS, loadGoogleFont } from './engine/fonts';

const EXAMPLES = [
  { title: 'Launching Our New API Platform', description: 'Build integrations faster with real-time webhooks and SDKs.', gradient: 0, accent: 0, layout: 'left' as const },
  { title: 'Design Systems at Scale', description: 'How we ship consistent UI to 200 micro-frontends.', gradient: 1, accent: 1, layout: 'center' as const },
  { title: '10x Faster Image Generation', description: 'Server-side rendering without headless browsers.', gradient: 4, accent: 2, layout: 'left' as const },
  { title: 'The Future of Edge Computing', description: 'Deploy globally in under 50ms cold start.', gradient: 2, accent: 4, layout: 'bottom' as const },
];

export default function OutputGallery() {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [rendered, setRendered] = useState(false);
  const fontEntry = FONTS[0];

  useEffect(() => { loadGoogleFont(fontEntry); }, []);

  useEffect(() => {
    if (rendered) return;
    const id = setTimeout(() => {
      EXAMPLES.forEach((ex, i) => {
        const canvas = canvasRefs.current[i];
        if (!canvas) return;
        renderCard(canvas, {
          title: ex.title,
          description: ex.description,
          author: 'OG Engine',
          tag: 'Example',
          format: 'og',
          accent: ACCENTS[ex.accent].color,
          layout: ex.layout,
          titleSize: 48,
          descSize: 22,
          fontEntry,
          gradient: GRADIENTS[ex.gradient],
          bgImage: null,
          overlayOpacity: 0.65,
        });
      });
      setRendered(true);
    }, 200);
    return () => clearTimeout(id);
  }, [fontEntry, rendered]);

  return (
    <div className="gallery-strip">
      {EXAMPLES.map((ex, i) => (
        <div key={i} className="gallery-card">
          <canvas
            ref={(el) => { canvasRefs.current[i] = el; }}
            width={1200}
            height={630}
            style={{ width: '100%', display: 'block', aspectRatio: '1200/630', borderRadius: 6 }}
          />
        </div>
      ))}
    </div>
  );
}
