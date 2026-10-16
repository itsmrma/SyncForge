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
    followingRef.current =
      element.scrollHeight - element.clientHeight - element.scrollTop <= 2;
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
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 0,
          bgcolor: '#070A10',
          color: '#E2E8F0',
          p: 2,
          fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
          overflowY: 'auto',
          overflowAnchor: 'none',
          fontSize: '0.82rem',
          lineHeight: 1.55,
          border: '1px solid rgba(148, 163, 184, 0.16)',
          borderRadius: 2,
          userSelect: 'text',
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', userSelect: 'text' }}>
          {text}
        </pre>
      </Paper>
      {paused && visible && (
        <Button
          variant="contained"
          size="small"
          startIcon={<ArrowDownward />}
          aria-label="Go to end of terminal"
          onClick={goToEnd}
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 12,
            borderRadius: 2,
            boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
          }}
        >
          Go to end
        </Button>
      )}
    </Box>
  );
}
