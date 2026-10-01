import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'How is this so fast?',
    answer: 'OG Engine uses Pretext for text measurement — the same Unicode segmentation engine, running server-side with Canvas. No browser startup, no DOM layout, no paint cycle. Text layout takes about 0.1ms. A full render is 21.57ms median on an Apple M2, and PNG encoding is ~21ms of that — so the win over Puppeteer is the browser you never launch, not the encoder. Cold-start headless Chrome takes 657ms for the same image.',
  },
  {
    question: 'Does it handle non-Latin scripts?',
    answer: 'CJK and Arabic glyphs render correctly from the bundled Noto Sans JP, SC, KR and Arabic fonts, including right-to-left Arabic shaping. Two limits apply today: no emoji font is bundled, so emoji render as a missing-glyph box, and line breaking splits on whitespace, so a Japanese or Chinese title longer than one line will not wrap.',
  },
  {
    question: 'Can I validate text without generating an image?',
    answer: 'Yes. POST /validate checks if your text fits a layout — free, no authentication required, and it never consumes render quota. Like the render endpoints it is rate limited to 100 requests per minute per IP. Use it to catch overflow before rendering.',
  },
  {
    question: 'Is there a free plan?',
    answer: 'Yes. 500 renders/month, forever. No credit card, no expiration. Same engine, same speed, same quality as paid plans.',
  },
  {
    question: 'Can I self-host?',
    answer: 'Yes. OG Engine ships as an open-source Docker image. Run it on your own infrastructure with zero per-render cost.',
  },
  {
    question: 'What about custom templates?',
    answer: 'Scale plan (€99/mo) supports custom JSON templates. All plans get 13 built-in templates. A visual template builder is on the roadmap.',
  },
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="faq-accordion">
      {FAQS.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i} className={`faq-item ${isOpen ? 'faq-item-open' : ''}`}>
            <button
              className="faq-question"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span>{faq.question}</span>
              <span className="faq-chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
            </button>
            <div className="faq-answer" style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}>
              <div className="faq-answer-inner">
                <p>{faq.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
