import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
} from '@mui/material';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

export default function Terminal({ text, visible, onFollowChange }) {
  const containerRef = useRef(null);
  const followingRef = useRef(true);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { displayedText, matchCount } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (filter === 'all' && !q) {
      return { displayedText: text, matchCount: 0 };
    }
    if (!text) {
      return { displayedText: '', matchCount: 0 };
    }
    let lines = text.split('\n');
    if (filter === 'errors') {
      lines = lines.filter((l) =>
        /\b(error|failed|fatal|exception)\b|\[error\]/i.test(l)
      );
    } else if (filter === 'warnings') {
      lines = lines.filter((l) => /\b(warn|warning)\b|\[warn/i.test(l));
    }
    if (q) {
      const matched = lines.filter((l) => l.toLowerCase().includes(q));
      return {
        displayedText: matched.join('\n'),
        matchCount: matched.length,
      };
    }
    return {
      displayedText: lines.join('\n'),
      matchCount: 0,
    };
  }, [text, filter, searchQuery]);

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
            alignItems: 'center',
            gap: 0.75,
            zIndex: 2,
            bgcolor: 'rgba(7, 10, 16, 0.88)',
            px: 1,
            py: 0.4,
            borderRadius: 1.5,
            border: '1px solid rgba(148, 163, 184, 0.18)',
          }}
        >
          <TextField
            size="small"
            placeholder="Search logs..."
            aria-label="Search terminal logs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 155,
              '& .MuiOutlinedInput-root': {
                height: 22,
                fontSize: '0.70rem',
                fontFamily: 'monospace',
                bgcolor: 'rgba(15, 20, 31, 0.9)',
                '& input': {
                  py: 0,
                  px: 0.5,
                },
              },
            }}
            slotProps={{
              htmlInput: {
                'aria-label': 'Search terminal logs',
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start" sx={{ mr: 0.25 }}>
                    <SearchIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label="Clear log search"
                      onClick={() => setSearchQuery('')}
                      edge="end"
                      sx={{ p: 0.15 }}
                    >
                      <ClearIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
          {searchQuery.trim() && (
            <Chip
              size="small"
              label={`${matchCount} match${matchCount === 1 ? '' : 'es'}`}
              sx={{
                height: 20,
                fontSize: '0.66rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                bgcolor: 'rgba(56, 189, 248, 0.16)',
                color: '#38BDF8',
              }}
            />
          )}
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
