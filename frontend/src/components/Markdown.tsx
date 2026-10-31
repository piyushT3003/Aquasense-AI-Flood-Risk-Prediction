import React from "react";

/** Tiny renderer for the assistant's answers: **bold**, "- " bullets, blank-line paragraphs. */
function inline(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={`${key}-${i}`} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>);
}

export const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length) {
      blocks.push(<ul key={`ul-${k}`} className="my-1 list-disc space-y-1 pl-5">{list.map((l, i) => <li key={i}>{inline(l, `li-${k}-${i}`)}</li>)}</ul>);
      list = [];
    }
  };
  text.split("\n").forEach((line, k) => {
    const t = line.trim();
    if (/^[-*•]\s+/.test(t)) list.push(t.replace(/^[-*•]\s+/, ""));
    else if (/^\d+\.\s+/.test(t)) list.push(t.replace(/^\d+\.\s+/, ""));
    else { flush(k); if (t) blocks.push(<p key={k} className="my-1">{inline(t, `p-${k}`)}</p>); }
  });
  flush(-1);
  return <div className="leading-relaxed">{blocks}</div>;
};
