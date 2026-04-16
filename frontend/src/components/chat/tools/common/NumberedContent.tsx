import { memo, useMemo } from 'react';

interface NumberedContentProps {
  content: string;
  // When provided, capture group 1 supplies the displayed line number and the
  // full match is stripped from the rendered content. Lets us reuse the same
  // gutter renderer for agents whose read output already embeds line numbers
  // (Claude: "N→" / "N\t", Copilot-via-Claude: "N. ") alongside raw content.
  prefixPattern?: RegExp;
}

interface ParsedLine {
  lineNum: string;
  text: string;
}

const NumberedContentInner: React.FC<NumberedContentProps> = ({ content, prefixPattern }) => {
  const lines = useMemo<ParsedLine[]>(
    () =>
      content.split('\n').map((line, idx) => {
        if (prefixPattern) {
          const match = line.match(prefixPattern);
          if (match) return { lineNum: match[1], text: line.slice(match[0].length) };
        }
        return { lineNum: String(idx + 1), text: line };
      }),
    [content, prefixPattern],
  );

  return (
    <div className="max-h-48 overflow-auto font-mono text-2xs leading-relaxed">
      {lines.map((line, idx) => (
        <div key={idx} className="flex">
          <span className="w-8 flex-shrink-0 select-none pr-2 text-right text-text-quaternary dark:text-text-dark-quaternary">
            {line.lineNum}
          </span>
          <span className="whitespace-pre text-text-tertiary dark:text-text-dark-tertiary">
            {line.text || '\u00A0'}
          </span>
        </div>
      ))}
    </div>
  );
};

export const NumberedContent = memo(NumberedContentInner);
