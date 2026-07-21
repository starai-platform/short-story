"use client";
import { useEffect, useState } from "react";

const phrases = ["完整生命。", "清晰脉络。", "动人灵魂。"];

export function TypewriterText() {
  const [phrase, setPhrase] = useState(0);
  const [length, setLength] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const text = phrases[phrase];
    const done = length === text.length;
    const empty = length === 0;
    const delay = done && !deleting ? 1500 : deleting ? 75 : 150;
    const timer = window.setTimeout(() => {
      if (done && !deleting) return setDeleting(true);
      if (empty && deleting) { setDeleting(false); setPhrase((current) => (current + 1) % phrases.length); return; }
      setLength((current) => current + (deleting ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [deleting, length, phrase]);
  return <span className="landing-gradient-text mt-3 block min-h-[1.08em] italic sm:mt-5"><span>{phrases[phrase].slice(0, length)}</span><span aria-hidden className="ml-1 inline-block h-[.78em] w-[3px] animate-pulse bg-current align-baseline" /></span>;
}
