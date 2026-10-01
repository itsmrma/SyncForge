import { useLayoutEffect, useRef } from 'react';
import { Paper } from '@mui/material';

export default function Terminal({ text, visible, onFollowChange }) {
  const containerRef = useRef(null);
  const followingRef = useRef(true);

  useLayoutEffect(() => {
    if (visible && followingRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, visible]);

  const handleScroll = () => {
    const element = containerRef.current;
    // Allow for subpixel rounding in the platform's webview.
    followingRef.current = element.scrollHeight - element.clientHeight - element.scrollTop <= 2;
    onFollowChange(followingRef.current);
  };

  return (
    <Paper
      ref={containerRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Task terminal"
      sx={{ flex: 1, minHeight: 0, bgcolor: '#1D1B20', color: '#D0BCFF', p: 2,
        fontFamily: 'monospace', overflowY: 'auto', overflowAnchor: 'none', fontSize: '0.85rem',
        border: '1px solid #36343B', borderRadius: 2, userSelect: 'text' }}
    >
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', userSelect: 'text' }}>{text}</pre>
    </Paper>
  );
}
