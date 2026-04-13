import { prepare, layout, prepareWithSegments, layoutWithLines } from './pretext/layout.js';

export const measureMessage = (text: string, font: string, width: number) => {
  const prepared = prepare(text, font);
  const { height, lineCount } = layout(prepared, width, 20); // 20 is line height
  return { height, lineCount };
};

export const layoutMessage = (text: string, font: string, width: number) => {
  const prepared = prepareWithSegments(text, font);
  const { lines } = layoutWithLines(prepared, width, 20);
  return lines;
};
