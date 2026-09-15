'use client';
import { useState } from 'react';
// Which way a control that steps through ordered options has just moved. The animation itself is a
// view transition (`src/ui/layout/PageTransition.tsx`); this only says forward or back, so the
// transition can encode a direction the reader chose rather than guess one.
export function useStepMotion(index: number) {
  const [seen, setSeen] = useState(index);
  const [forward, setForward] = useState(true);
  // Derived during render rather than in an effect: the direction has to be known in the same
  // commit that swaps the content, which is the commit the browser captures.
  if (seen !== index) {
    setSeen(index);
    setForward(index > seen);
  }
  return { step: index, transition: forward ? 'step-forward' : 'step-back' };
}
