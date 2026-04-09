import type { RenderResult } from '../engine/canvas-renderer';
import type { FormatKey } from '../engine/formats';
import { FormatSelector } from './FormatSelector';
import { RenderHUD } from './RenderHUD';

interface Props {
  format: FormatKey;
  onFormatChange: (value: FormatKey) => void;
  renderTime: number;
  info: RenderResult | null;
  accent: string;
}

export function PreviewToolbar({ format, onFormatChange, renderTime, info, accent }: Props) {
  return (
    <div
      className="pg-preview-toolbar"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '8px 4px', marginBottom: 12,
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
        <FormatSelector value={format} onChange={onFormatChange} accent={accent} />
      </div>
      <div style={{ flex: '0 0 auto' }}>
        <RenderHUD renderTime={renderTime} info={info} accent={accent} />
      </div>
    </div>
  );
}
