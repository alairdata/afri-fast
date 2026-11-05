// A multi-line text box that grows as the person types, so every line stays in view, then scrolls inside
// once it reaches maxHeight. Phones grow on their own given a maxHeight. The web's box doesn't, so there it's
// measured on every change, which also lets it shrink again when text is deleted or sent.
import React, { useLayoutEffect, useRef } from 'react';
import { Platform, TextInput } from 'react-native';

const GrowingTextInput = ({ maxHeight = 200, style, value, ...props }) => {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') return;
    const box = ref.current;
    if (!box?.style) return;
    box.style.height = 'auto';
    const borders = box.offsetHeight - box.clientHeight;
    const needed = box.scrollHeight + borders;
    if (needed <= borders) { box.style.height = ''; return; } // not on screen yet, nothing to measure
    box.style.height = `${Math.min(needed, maxHeight)}px`;
    box.style.overflowY = needed > maxHeight ? 'auto' : 'hidden';
  }, [value, maxHeight]);

  return <TextInput ref={ref} {...props} multiline rows={1} value={value} style={[style, { maxHeight }]} />;
};

export default GrowingTextInput;
