import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Download from '@mui/icons-material/Download';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';
import UnfoldLess from '@mui/icons-material/UnfoldLess';
import UnfoldMore from '@mui/icons-material/UnfoldMore';
import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined';
import HorizontalSplitOutlined from '@mui/icons-material/HorizontalSplitOutlined';
import CloseIcon from '@mui/icons-material/Close';

function Terminal({
  text,
  visible,
  onFollowChange,
  onCopy,
  copied = false,
  onDownload,
  onClear,
  expanded = false,
  onToggleExpand,
  docked = false,
  canDock = false,
  onToggleDock,
  onClose,
}) {
  const containerRef = useRef(null);
  const followingRef = useRef(true);
  const savedScrollTopRef = useRef(0);
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
    if (!visible || !containerRef.current) return;
    if (followingRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    } else {
      containerRef.current.scrollTop = savedScrollTopRef.current;
    }
  }, [displayedText, visible, docked]);

  const handleScroll = () => {
    const element = containerRef.current;
    if (!element || !visible) return;
    savedScrollTopRef.current = element.scrollTop;
    followingRef.current =
      element.scrollHeight - element.clientHeight - element.scrollTop <= 2;
    setPaused(!followingRef.current);
    onFollowChange?.(followingRef.current);
  };

  const goToEnd = () => {
    followingRef.current = true;
    setPaused(false);
    onFollowChange?.(true);
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      savedScrollTopRef.current = containerRef.current.scrollTop;
    }
  };

  return (
    <Box
      data-testid="terminal-shell"
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        bgcolor: '#070A10',
        border: '1px solid rgba(148, 163, 184, 0.20)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {visible && (
        <Box
          data-testid="terminal-header-bar"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
            px: 1.5,
            py: 0.75,
            bgcolor: '#111622',
            borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#94A3B8',
                fontSize: '0.68rem',
                mr: 0.5,
              }}
            >
              Console
            </Typography>
            <TextField
              size="small"
              placeholder="Search logs..."
              aria-label="Search terminal logs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                width: 150,
                '& .MuiOutlinedInput-root': {
                  height: 24,
                  fontSize: '0.72rem',
                  fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
                  bgcolor: '#070A10',
                  color: '#E2E8F0',
                  '& fieldset': {
                    borderColor: 'rgba(148, 163, 184, 0.22)',
                  },
                  '& input': {
                    py: 0,
                    px: 0.5,
                    color: '#E2E8F0',
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
                      <SearchIcon sx={{ fontSize: 13, color: '#94A3B8' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label="Clear log search"
                        onClick={() => setSearchQuery('')}
                        edge="end"
                        sx={{ p: 0.15, color: '#94A3B8' }}
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
                  ...(filter !== item.id && {
                    color: '#CBD5E1',
                    borderColor: 'rgba(148, 163, 184, 0.25)',
                  }),
                }}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            {Boolean(text) && onCopy && (
              <Button
                size="small"
                aria-label="Copy Logs"
                startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
                onClick={onCopy}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.72rem',
                  color: '#CBD5E1',
                  '&:hover': { color: '#F8FAFC', bgcolor: 'rgba(148, 163, 184, 0.12)' },
                }}
              >
                {copied ? 'Copied!' : 'Copy Logs'}
              </Button>
            )}
            {Boolean(text) && onDownload && (
              <Button
                size="small"
                aria-label="Download Logs"
                startIcon={<Download sx={{ fontSize: 14 }} />}
                onClick={onDownload}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.72rem',
                  color: '#CBD5E1',
                  '&:hover': { color: '#F8FAFC', bgcolor: 'rgba(148, 163, 184, 0.12)' },
                }}
              >
                Download Logs
              </Button>
            )}
            {Boolean(text) && onClear && (
              <Button
                size="small"
                aria-label="Clear Logs"
                startIcon={<DeleteSweepOutlined sx={{ fontSize: 14 }} />}
                onClick={onClear}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.72rem',
                  color: '#CBD5E1',
                  '&:hover': { color: '#F43F5E', bgcolor: 'rgba(244, 63, 94, 0.12)' },
                }}
              >
                Clear Logs
              </Button>
            )}
            {canDock && onToggleDock && (
              <Tooltip title={docked ? 'Move console to bottom drawer' : 'Dock console to right column'}>
                <Button
                  size="small"
                  aria-label={docked ? 'Dock terminal to bottom' : 'Dock terminal to side'}
                  startIcon={
                    docked ? (
                      <HorizontalSplitOutlined sx={{ fontSize: 14 }} />
                    ) : (
                      <ViewSidebarOutlined sx={{ fontSize: 14 }} />
                    )
                  }
                  onClick={onToggleDock}
                  sx={{
                    minWidth: 0,
                    px: 1,
                    py: 0.25,
                    fontSize: '0.72rem',
                    color: docked ? '#38BDF8' : '#CBD5E1',
                    '&:hover': { color: '#F8FAFC', bgcolor: 'rgba(148, 163, 184, 0.12)' },
                  }}
                >
                  {docked ? 'Bottom Drawer' : 'Dock to Side'}
                </Button>
              </Tooltip>
            )}
            {!docked && onToggleExpand && (
              <Button
                size="small"
                aria-label="Toggle expanded terminal"
                startIcon={
                  expanded ? (
                    <UnfoldLess sx={{ fontSize: 14 }} />
                  ) : (
                    <UnfoldMore sx={{ fontSize: 14 }} />
                  )
                }
                onClick={onToggleExpand}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.72rem',
                  color: '#CBD5E1',
                  '&:hover': { color: '#F8FAFC', bgcolor: 'rgba(148, 163, 184, 0.12)' },
                }}
              >
                {expanded ? 'Compact Terminal' : 'Expand Terminal'}
              </Button>
            )}
            {onClose && (
              <Button
                size="small"
                aria-label="Hide Terminal"
                startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
                onClick={onClose}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: '0.72rem',
                  color: '#CBD5E1',
                  '&:hover': { color: '#F8FAFC', bgcolor: 'rgba(148, 163, 184, 0.12)' },
                }}
              >
                Hide Terminal
              </Button>
            )}
          </Box>
        </Box>
      )}
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
          borderRadius: 0,
          userSelect: 'text',
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', userSelect: 'text' }}>
          {displayedText}
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

export default memo(Terminal);
