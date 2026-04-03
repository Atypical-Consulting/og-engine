import { useEffect, useRef, useState } from 'react';
import { renderCard } from './engine/canvas-renderer';
import { GRADIENTS, ACCENTS } from './engine/gradients';
import { FONTS, loadGoogleFont } from './engine/fonts';

const EXAMPLES = [
  { title: 'Launching Our New API Platform', description: 'Build integrations faster with real-time webhooks and SDKs for every language.', gradient: 0, accent: 0, layout: 'left' as const },
  { title: 'Design Systems at Scale', description: 'How we ship consistent UI to 200 micro-frontends.', gradient: 1, accent: 1, layout: 'center' as const },
  { title: '10x Faster Image Generation', description: 'Server-side rendering without headless browsers.', gradient: 4, accent: 2, layout: 'left' as const },
];

export default function OutputGallery() {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [rendered, setRendered] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const fontEntry = FONTS[0];

  useEffect(() => { loadGoogleFont(fontEntry); }, []);

  useEffect(() => {
    if (rendered) return;

    function renderAll() {
      EXAMPLES.forEach((ex, i) => {
        const canvas = canvasRefs.current[i];
        if (!canvas) return;
        try {
          renderCard(canvas, {
            title: ex.title,
            description: ex.description,
            author: 'OG Engine',
            tag: 'Example',
            format: 'og',
            accent: ACCENTS[ex.accent],
            layout: ex.layout,
            titleSize: 48,
            descSize: 22,
            fontEntry,
            gradient: GRADIENTS[ex.gradient],
            bgImage: null,
            overlayOpacity: 0.65,
          });
        } catch {
          // skip failed canvas
        }
      });
      setRendered(true);
    }

    if (document.fonts && fontEntry.name) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(renderAll);
      });
    } else {
      const id = setTimeout(renderAll, 300);
      return () => clearTimeout(id);
    }
  }, [fontEntry, rendered]);

  // Auto-rotate every 4 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex(i => (i + 1) % EXAMPLES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="gallery-featured not-content">
      {/* Large featured image */}
      <div className="gallery-main">
        {EXAMPLES.map((ex, i) => (
          <canvas
            key={i}
            ref={(el) => { canvasRefs.current[i] = el; }}
            width={1200}
            height={630}
            className={`gallery-main-canvas ${i === activeIndex ? 'gallery-main-active' : ''}`}
            style={{ aspectRatio: '1200/630' }}
          />
        ))}
      </div>

      {/* Thumbnail selectors */}
      <div className="gallery-thumbs">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            className={`gallery-thumb ${i === activeIndex ? 'gallery-thumb-active' : ''}`}
            onClick={() => setActiveIndex(i)}
            aria-label={`Show example: ${ex.title}`}
          >
            <span className="gallery-thumb-dot" />
            <span className="gallery-thumb-label">{ex.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
