import '../playground.css';

interface Props {
  visible: boolean;
  accent: string;
}

export function DropZone({ visible, accent }: Props) {
  if (!visible) return null;

  return (
    <div className="pg-dropzone" style={{ borderColor: `${accent}44` }}>
      <div style={{
        textAlign: 'center', padding: 20, borderRadius: 12,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
        <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}>
          Drop image here
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          PNG, JPG, or WebP as background
        </div>
      </div>
    </div>
  );
}
