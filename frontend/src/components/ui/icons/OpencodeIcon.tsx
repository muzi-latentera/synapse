import type { SVGProps } from 'react';

export function OpencodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="none" {...props}>
      <path fill="currentColor" fillOpacity="0.5" d="M320 224V352H192V224H320Z" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
      />
    </svg>
  );
}
