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
import CheckRounded from '@mui/icons-material/CheckRounded';
import Download from '@mui/icons-material/Download';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';
import UnfoldLess from '@mui/icons-material/UnfoldLess';
import UnfoldMore from '@mui/icons-material/UnfoldMore';
import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined';
import HorizontalSplitOutlined from '@mui/icons-material/HorizontalSplitOutlined';
import CloseIcon from '@mui/icons-material/Close';
import TerminalOutlined from '@mui/icons-material/TerminalOutlined';

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
        border: '1px solid rgba(148, 163, 184, 0.18)',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {visible && (
        <Box
          data-testid="terminal-header-bar"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 1.5,
            py: 0.65,
            minHeight: 38,
            bgcolor: '#0D121D',
            borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
            flexShrink: 0,
          }}
        >
          {/* Left Zone: Console Identity, Log Level Filter, Search */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minWidth: 0,
              flexWrap: 'nowrap',
            }}
          >
            {/* Console Identity */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                flexShrink: 0,
              }}
            >
              <TerminalOutlined sx={{ fontSize: 15, color: '#38BDF8' }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#94A3B8',
                  fontSize: '0.68rem',
                  userSelect: 'none',
                }}
              >
                Console
              </Typography>
            </Box>

            {/* Segmented Filter Control */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                p: '2px',
                borderRadius: '6px',
                bgcolor: '#070A10',
                border: '1px solid rgba(148, 163, 184, 0.16)',
                flexShrink: 0,
              }}
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'errors', label: 'Errors' },
                { id: 'warnings', label: 'Warnings' },
              ].map((item) => {
                const isSelected = filter === item.id;
                return (
                  <Button
                    key={item.id}
                    size="small"
                    aria-label={item.label}
                    onClick={() => setFilter(item.id)}
                    sx={{
                      minWidth: 0,
                      px: 0.9,
                      py: '2px',
                      height: 20,
                      fontSize: '0.67rem',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '4px',
                      color: isSelected
                        ? item.id === 'errors'
                          ? '#F43F5E'
                          : item.id === 'warnings'
                            ? '#F59E0B'
                            : '#38BDF8'
                        : '#94A3B8',
                      bgcolor: isSelected
                        ? item.id === 'errors'
                          ? 'rgba(244, 63, 94, 0.16)'
                          : item.id === 'warnings'
                            ? 'rgba(245, 158, 11, 0.16)'
                            : 'rgba(56, 189, 248, 0.14)'
                        : 'transparent',
                      '&:hover': {
                        bgcolor: isSelected
                          ? undefined
                          : 'rgba(148, 163, 184, 0.08)',
                        color: '#E2E8F0',
                      },
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Box>

            {/* Integrated Search Input */}
            <TextField
              size="small"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                width: { xs: 110, sm: 140, md: 160 },
                flexShrink: 1,
                '& .MuiOutlinedInput-root': {
                  height: 24,
                  fontSize: '0.70rem',
                  fontFamily:
                    '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
                  bgcolor: '#070A10',
                  color: '#E2E8F0',
                  borderRadius: '5px',
                  '& fieldset': {
                    borderColor: 'rgba(148, 163, 184, 0.18)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(148, 163, 184, 0.32)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#6366F1',
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
                      <SearchIcon sx={{ fontSize: 13, color: '#64748B' }} />
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

            {/* Match Counter Chip */}
            {searchQuery.trim() && (
              <Chip
                size="small"
                label={`${matchCount} match${matchCount === 1 ? '' : 'es'}`}
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  bgcolor:
                    matchCount > 0
                      ? 'rgba(56, 189, 248, 0.15)'
                      : 'rgba(148, 163, 184, 0.12)',
                  color: matchCount > 0 ? '#38BDF8' : '#94A3B8',
                  border: '1px solid',
                  borderColor:
                    matchCount > 0
                      ? 'rgba(56, 189, 248, 0.3)'
                      : 'rgba(148, 163, 184, 0.2)',
                  flexShrink: 0,
                }}
              />
            )}
          </Box>

          {/* Right Zone: Grouped Actions (Log Data & Window Controls) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexShrink: 0,
            }}
          >
            {/* Log Content Actions: Copy, Download, Clear */}
            {Boolean(text) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                {onCopy && (
                  <Tooltip
                    title={copied ? 'Copied to clipboard!' : 'Copy logs'}
                    arrow
                    enterDelay={300}
                  >
                    <IconButton
                      size="small"
                      aria-label="Copy Logs"
                      onClick={onCopy}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '6px',
                        color: copied ? '#34D399' : '#94A3B8',
                        bgcolor: copied
                          ? 'rgba(52, 211, 153, 0.15)'
                          : 'transparent',
                        '&:hover': {
                          color: copied ? '#34D399' : '#F8FAFC',
                          bgcolor: copied
                            ? 'rgba(52, 211, 153, 0.2)'
                            : 'rgba(148, 163, 184, 0.12)',
                        },
                      }}
                    >
                      {copied ? (
                        <CheckRounded sx={{ fontSize: 14, color: '#34D399' }} />
                      ) : (
                        <ContentCopy sx={{ fontSize: 14 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                )}

                {onDownload && (
                  <Tooltip
                    title="Download logs (.txt)"
                    arrow
                    enterDelay={300}
                  >
                    <IconButton
                      size="small"
                      aria-label="Download Logs"
                      onClick={onDownload}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '6px',
                        color: '#94A3B8',
                        '&:hover': {
                          color: '#F8FAFC',
                          bgcolor: 'rgba(148, 163, 184, 0.12)',
                        },
                      }}
                    >
                      <Download sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}

                {onClear && (
                  <Tooltip title="Clear logs" arrow enterDelay={300}>
                    <IconButton
                      size="small"
                      aria-label="Clear Logs"
                      onClick={onClear}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '6px',
                        color: '#94A3B8',
                        '&:hover': {
                          color: '#F43F5E',
                          bgcolor: 'rgba(244, 63, 94, 0.12)',
                        },
                      }}
                    >
                      <DeleteSweepOutlined sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            )}

            {/* Subtle Vertical Divider between Content Actions and Window Controls */}
            {Boolean(text) &&
              (onCopy || onDownload || onClear) &&
              (canDock || onToggleExpand || onClose) && (
                <Box
                  sx={{
                    width: '1px',
                    height: 16,
                    bgcolor: 'rgba(148, 163, 184, 0.2)',
                    mx: 0.35,
                  }}
                />
              )}

            {/* Window / Layout Controls: Dock, Expand/Compact, Hide */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {canDock && onToggleDock && (
                <Tooltip
                  title={
                    docked ? 'Dock to bottom drawer' : 'Dock to side panel'
                  }
                  arrow
                  enterDelay={300}
                >
                  <IconButton
                    size="small"
                    aria-label={
                      docked
                        ? 'Dock terminal to bottom'
                        : 'Dock terminal to side'
                    }
                    onClick={onToggleDock}
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '6px',
                      color: docked ? '#38BDF8' : '#94A3B8',
                      bgcolor: docked
                        ? 'rgba(56, 189, 248, 0.14)'
                        : 'transparent',
                      '&:hover': {
                        color: docked ? '#38BDF8' : '#F8FAFC',
                        bgcolor: docked
                          ? 'rgba(56, 189, 248, 0.2)'
                          : 'rgba(148, 163, 184, 0.12)',
                      },
                    }}
                  >
                    {docked ? (
                      <HorizontalSplitOutlined sx={{ fontSize: 14 }} />
                    ) : (
                      <ViewSidebarOutlined sx={{ fontSize: 14 }} />
                    )}
                  </IconButton>
                </Tooltip>
              )}

              {!docked && onToggleExpand && (
                <Tooltip
                  title={expanded ? 'Compact terminal' : 'Expand terminal'}
                  arrow
                  enterDelay={300}
                >
                  <IconButton
                    size="small"
                    aria-label="Toggle expanded terminal"
                    onClick={onToggleExpand}
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '6px',
                      color: expanded ? '#38BDF8' : '#94A3B8',
                      bgcolor: expanded
                        ? 'rgba(56, 189, 248, 0.14)'
                        : 'transparent',
                      '&:hover': {
                        color: expanded ? '#38BDF8' : '#F8FAFC',
                        bgcolor: expanded
                          ? 'rgba(56, 189, 248, 0.2)'
                          : 'rgba(148, 163, 184, 0.12)',
                      },
                    }}
                  >
                    {expanded ? (
                      <UnfoldLess sx={{ fontSize: 14 }} />
                    ) : (
                      <UnfoldMore sx={{ fontSize: 14 }} />
                    )}
                  </IconButton>
                </Tooltip>
              )}

              {onClose && (
                <Tooltip
                  title="Hide terminal (Ctrl+L)"
                  arrow
                  enterDelay={300}
                >
                  <IconButton
                    size="small"
                    aria-label="Hide Terminal"
                    onClick={onClose}
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '6px',
                      color: '#94A3B8',
                      '&:hover': {
                        color: '#F8FAFC',
                        bgcolor: 'rgba(148, 163, 184, 0.14)',
                      },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
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
          fontFamily:
            '"JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
          overflowY: 'auto',
          overflowAnchor: 'none',
          fontSize: '0.82rem',
          lineHeight: 1.55,
          borderRadius: 0,
          userSelect: 'text',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'rgba(7, 10, 16, 0.5)',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'rgba(148, 163, 184, 0.2)',
            borderRadius: '4px',
            '&:hover': {
              bgcolor: 'rgba(148, 163, 184, 0.35)',
            },
          },
          '& ::selection': {
            bgcolor: 'rgba(99, 102, 241, 0.35)',
            color: '#FFFFFF',
          },
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
          startIcon={<ArrowDownward sx={{ fontSize: 13 }} />}
          aria-label="Go to end of terminal"
          onClick={goToEnd}
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 12,
            borderRadius: 999,
            px: 1.5,
            py: 0.4,
            minHeight: 28,
            fontSize: '0.70rem',
            fontWeight: 700,
            textTransform: 'none',
            letterSpacing: '0.02em',
            bgcolor: 'rgba(15, 23, 42, 0.94)',
            color: '#38BDF8',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            '&:hover': {
              bgcolor: 'rgba(30, 41, 59, 0.98)',
              borderColor: '#38BDF8',
            },
          }}
        >
          Go to end
        </Button>
      )}
    </Box>
  );
}

export default memo(Terminal);
