import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'How is this so fast?',
    answer: 'OG Engine uses Pretext for text measurement — the same Unicode segmentation engine, running server-side with Canvas. No browser startup, no DOM layout, no paint cycle. Just math and pixels.',
  },
  {
    question: 'Does it handle non-Latin scripts?',
    answer: 'Yes. Pretext handles CJK (Chinese, Japanese, Korean), Arabic (with bidirectional text), emoji, grapheme clusters, and mixed-script content. Pre-loaded fonts include Noto Sans JP and Noto Sans AR.',
  },
  {
    question: 'Can I validate text without generating an image?',
    answer: 'Yes. POST /validate checks if your text fits a layout — free, unlimited, no authentication required. Use it to catch overflow before rendering.',
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
    answer: 'Scale plan (€99/mo) supports custom JSON templates. All plans get 4 built-in templates. A visual template builder is on the roadmap.',
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
            <div className="faq-answer" style={{ maxHeight: isOpen ? '200px' : '0' }}>
              <p>{faq.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
