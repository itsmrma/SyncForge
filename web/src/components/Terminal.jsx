import { useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Paper } from '@mui/material';
import ArrowDownward from '@mui/icons-material/ArrowDownward';

export default function Terminal({ text, visible, onFollowChange }) {
  const containerRef = useRef(null);
  const followingRef = useRef(true);
  const [paused, setPaused] = useState(false);

  useLayoutEffect(() => {
    if (visible && followingRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, visible]);

  const handleScroll = () => {
    const element = containerRef.current;
    // Allow for subpixel rounding in the platform's webview.
    followingRef.current = element.scrollHeight - element.clientHeight - element.scrollTop <= 2;
    setPaused(!followingRef.current);
    onFollowChange(followingRef.current);
  };

  const goToEnd = () => {
    followingRef.current = true;
    setPaused(false);
    onFollowChange(true);
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  };

  return (
    <Box sx={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0 }}>
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
      {paused && visible && <Button variant="contained" size="small" startIcon={<ArrowDownward />}
        aria-label="Go to end of terminal" onClick={goToEnd}
        sx={{ position: 'absolute', right: 16, bottom: 12, borderRadius: 4, boxShadow: 3 }}>
        Go to end
      </Button>}
    </Box>
  );
}
