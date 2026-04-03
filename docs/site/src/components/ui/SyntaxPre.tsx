interface Props {
  code: string;
  language: 'bash' | 'typescript' | 'json';
}

function highlightJSON(code: string): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];
  const regex = /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(true|false|null)|(-?\d+(?:\.\d+)?)|([{}[\],:])|(\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: code.slice(lastIndex, match.index), color: '#94a3b8' });
    }
    if (match[1]) {
      parts.push({ text: match[1], color: '#67e8f9' });
      parts.push({ text: match[2], color: '#64748b' });
    } else if (match[3]) {
      parts.push({ text: match[3], color: '#a5d6a7' });
    } else if (match[4]) {
      parts.push({ text: match[4], color: '#c4b5fd' });
    } else if (match[5]) {
      parts.push({ text: match[5], color: '#fbbf24' });
    } else if (match[6]) {
      parts.push({ text: match[6], color: '#475569' });
    } else if (match[7]) {
      parts.push({ text: match[7], color: '#94a3b8' });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    parts.push({ text: code.slice(lastIndex), color: '#94a3b8' });
  }

  return parts;
}

function highlightBash(code: string): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) parts.push({ text: '\n', color: '#94a3b8' });
    const line = lines[i];

    const lineRegex = /(curl|POST|GET|Bearer|--\w[\w-]*|-[A-Za-z]\b)|('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(https?:\/\/\S+)|(\\\s*$)|(\S+)/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;

    while ((m = lineRegex.exec(line)) !== null) {
      if (m.index > lastIdx) {
        parts.push({ text: line.slice(lastIdx, m.index), color: '#94a3b8' });
      }
      if (m[1]) {
        parts.push({ text: m[1], color: '#67e8f9' });
      } else if (m[2]) {
        parts.push({ text: m[2], color: '#a5d6a7' });
      } else if (m[3]) {
        parts.push({ text: m[3], color: '#a5d6a7' });
      } else if (m[4]) {
        parts.push({ text: m[4], color: '#c4b5fd' });
      } else if (m[5]) {
        parts.push({ text: m[5], color: '#475569' });
      } else if (m[6]) {
        parts.push({ text: m[6], color: '#94a3b8' });
      }
      lastIdx = lineRegex.lastIndex;
    }

    if (lastIdx < line.length) {
      parts.push({ text: line.slice(lastIdx), color: '#94a3b8' });
    }
  }

  return parts;
}

function highlightTS(code: string): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];
  const regex = /(import|from|const|await|new|process)\b|('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(`(?:[^`\\]|\\.)*`)|(\/\/.*$)|(\.[\w]+)|(\w+)/gm;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: code.slice(lastIndex, match.index), color: '#94a3b8' });
    }
    if (match[1]) {
      parts.push({ text: match[1], color: '#c4b5fd' });
    } else if (match[2] || match[3] || match[4]) {
      parts.push({ text: match[0], color: '#a5d6a7' });
    } else if (match[5]) {
      parts.push({ text: match[5], color: '#475569' });
    } else if (match[6]) {
      parts.push({ text: match[6], color: '#67e8f9' });
    } else if (match[7]) {
      parts.push({ text: match[7], color: '#e2e8f0' });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < code.length) {
    parts.push({ text: code.slice(lastIndex), color: '#94a3b8' });
  }

  return parts;
}

export function SyntaxPre({ code, language }: Props) {
  const highlight = language === 'json' ? highlightJSON : language === 'bash' ? highlightBash : highlightTS;
  const parts = highlight(code);

  return (
    <pre style={{
      margin: 0, padding: 14, fontSize: 11, lineHeight: 1.6,
      overflowX: 'auto', background: '#0c0f1a', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>
      <code>
        {parts.map((p, i) => (
          <span key={i} style={{ color: p.color }}>{p.text}</span>
        ))}
      </code>
    </pre>
  );
}
