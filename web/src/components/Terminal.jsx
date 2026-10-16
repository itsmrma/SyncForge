import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, Paper } from '@mui/material';
import ArrowDownward from '@mui/icons-material/ArrowDownward';

export default function Terminal({ text, visible, onFollowChange }) {
  const containerRef = useRef(null);
  const followingRef = useRef(true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('all');

  const displayedText = useMemo(() => {
    if (filter === 'all' || !text) return text;
    const lines = text.split('\n');
    if (filter === 'errors') {
      return lines
        .filter((l) => /\b(error|failed|fatal|exception)\b|\[error\]/i.test(l))
        .join('\n');
    }
    if (filter === 'warnings') {
      return lines
        .filter((l) => /\b(warn|warning)\b|\[warn/i.test(l))
        .join('\n');
    }
    return text;
  }, [text, filter]);

  useLayoutEffect(() => {
    if (visible && followingRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedText, visible]);

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
          {displayedText}
        </pre>
      </Paper>
      {visible && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 16,
            display: 'flex',
            gap: 0.5,
            zIndex: 2,
            bgcolor: 'rgba(7, 10, 16, 0.85)',
            px: 0.75,
            py: 0.25,
            borderRadius: 1.5,
            border: '1px solid rgba(148, 163, 184, 0.15)',
          }}
        >
          {[
            { id: 'all', label: 'All' },
            { id: 'errors', label: 'Errors' },
            { id: 'warnings', label: 'Warnings' },
          ].map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              size="small"
              clickable
              onClick={() => setFilter(item.id)}
              color={filter === item.id ? 'primary' : 'default'}
              variant={filter === item.id ? 'filled' : 'outlined'}
              sx={{
                height: 20,
                fontSize: '0.68rem',
                fontWeight: 600,
              }}
            />
          ))}
        </Box>
      )}
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
