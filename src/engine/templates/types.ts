import type { Canvas, Image, SKRSContext2D } from '@napi-rs/canvas';
import type { Format } from '../formats';

export interface TemplateInput {
  canvas: Canvas;
  ctx: SKRSContext2D;
  width: number;
  height: number;
  format: Format;
  content: {
    title: string;
    description: string;
    author: string;
    tag: string;
  };
  style: {
    accent: string;
    layout: 'left' | 'center' | 'bottom';
    fontFamily: string;
    titleSize: number;
    descSize: number;
    gradient: string;
  };
  bgImage: Image | null;
  overlayOpacity: number;
  variables: Record<string, string>;
  namedImages: Record<string, Image | null>;
}

export interface TemplateResult {
  titleTotalLines: number;
  titleVisibleLines: number;
  descTotalLines: number;
  descVisibleLines: number;
  overflow: boolean;
}

export type TemplateFn = (input: TemplateInput) => TemplateResult;
