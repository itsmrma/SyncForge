import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import Replay from '@mui/icons-material/Replay';
import Settings from '@mui/icons-material/Settings';
import modules from '../modules';
import SettingsDialog from './SettingsDialog';
import { DEFAULT_SHORTCUTS, formatCompactShortcut, formatShortcutDisplay } from '../shortcuts';

function SyncForgeLogo({ size = 32 }) {
  return (
    <Box
      component="img"
      src="/icon.svg"
      alt="SyncForge logo"
      width={size}
      height={size}
      draggable={false}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 1.5,
        boxShadow: (theme) =>
          theme.palette.mode === 'light'
            ? '0 1px 3px rgba(15, 23, 42, 0.15), 0 1px 2px rgba(15, 23, 42, 0.10)'
            : '0 2px 8px rgba(0, 0, 0, 0.55)',
      }}
    />
  );
}

function Sidebar({
  selectedMod,
  onSelect,
  running,
  hasRun,
  onRepeat,
  settings,
  onSettingsChange,
  settingsOpen: controlledSettingsOpen,
  onSettingsOpenChange,
  settingsTab = 'general',
  onSettingsTabChange,
  shortcuts = DEFAULT_SHORTCUTS,
  onShortcutsChange,
  updater,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(320);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const rafId = useRef(null);

  const settingsOpen =
    controlledSettingsOpen !== undefined
      ? controlledSettingsOpen
      : internalSettingsOpen;
  const setSettingsOpen = (next) => {
    const val = typeof next === 'function' ? next(settingsOpen) : next;
    setInternalSettingsOpen(val);
    onSettingsOpenChange?.(val);
  };

  useEffect(() => {
    const move = (event) => {
      if (!dragging.current) return;
      event.preventDefault();
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        setWidth(Math.min(Math.max(event.clientX, 240), 600));
      });
    };
    const stop = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
      document.documentElement.style.webkitUserSelect = '';
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
    return () => {
      stop();
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', stop);
    };
  }, []);

  const repeatCombo = shortcuts?.repeat_last ?? DEFAULT_SHORTCUTS.repeat_last;
  const settingsCombo = shortcuts?.open_settings ?? DEFAULT_SHORTCUTS.open_settings;

  const titleFontSize = useMemo(() => {
    if (width <= 320) {
      const progress = (width - 240) / 80;
      return `${(0.80 + progress * 0.05).toFixed(3)}rem`;
    }
    const progress = Math.min((width - 320) / 280, 1);
    return `${(0.85 + progress * 0.05).toFixed(3)}rem`;
  }, [width]);

  const buttonFontSize = useMemo(() => {
    if (width <= 320) {
      const progress = (width - 240) / 80;
      return `${(0.76 + progress * 0.08).toFixed(3)}rem`;
    }
    return '0.84rem';
  }, [width]);

  return (
    <>
      <Box
        component="aside"
        aria-label="Modules and settings"
        sx={(theme) => ({
          width: collapsed ? 72 : width,
          flexShrink: 0,
          bgcolor: theme.palette.mode === 'light' ? '#EAECEF' : '#0D111A',
          boxShadow: collapsed ? `inset -1px 0 0 ${theme.palette.divider}` : 'none',
          display: 'flex',
          flexDirection: 'column',
          userSelect: isDragging ? 'none' : 'auto',
          overflowX: 'hidden',
          transition: isDragging ? 'none !important' : 'width 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: isDragging ? 'auto' : 'width',
        })}
      >
        <Box
          sx={{
            p: collapsed ? 1.5 : 2,
            pb: 1.5,
            display: 'flex',
            flexDirection: collapsed ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: collapsed ? 1 : 0,
            borderBottom: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
          }}
        >
          <Box
            onClick={collapsed ? () => setCollapsed(false) : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              cursor: collapsed ? 'pointer' : 'default',
              minWidth: 0,
            }}
          >
            <SyncForgeLogo size={32} />
            {!collapsed && (
              <Box
                sx={{
                  minWidth: 0,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  opacity: collapsed ? 0 : 1,
                  transition: isDragging
                    ? 'none'
                    : collapsed
                    ? 'opacity 60ms ease'
                    : 'opacity 120ms ease 120ms',
                }}
              >
                <Typography variant="h5" fontWeight="800" noWrap>
                  SyncForge
                </Typography>
              </Box>
            )}
          </Box>
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <IconButton
              size="small"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((value) => !value)}
              sx={{
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                flexShrink: 0,
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <ChevronLeft fontSize="small" />
              </Box>
            </IconButton>
          </Tooltip>
        </Box>

        <List sx={{ flex: 1, overflowY: 'auto', px: 1.5, pt: 1.5 }}>
          {modules.map((module, index) => {
            const active = selectedMod.id === module.id;
            const modCombo = shortcuts?.[`module_${index + 1}`] ?? DEFAULT_SHORTCUTS[`module_${index + 1}`];
            const compactHint = formatCompactShortcut(modCombo);
            return (
              <ListItem disablePadding key={module.id}>
                <Tooltip
                  title={
                    collapsed
                      ? modCombo
                        ? `${module.title} (${formatShortcutDisplay(modCombo)})`
                        : module.title
                      : ''
                  }
                  placement="right"
                >
                  <ListItemButton
                    aria-label={module.title}
                    selected={active}
                    disabled={running}
                    onClick={() => onSelect(module)}
                    sx={{
                      borderRadius: 1.75,
                      mb: 0.6,
                      py: 1,
                      px: width < 280 ? 1 : 1.5,
                      position: 'relative',
                      border: '1px solid',
                      borderColor: active
                        ? 'rgba(99, 102, 241, 0.4)'
                        : 'transparent',
                      overflow: 'hidden',
                      whiteSpace: collapsed ? 'nowrap' : 'normal',
                      alignItems: 'center',
                      '&.Mui-selected': {
                        bgcolor: 'rgba(99, 102, 241, 0.14)',
                        '&:hover': {
                          bgcolor: 'rgba(99, 102, 241, 0.20)',
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: width < 280 ? 28 : 32,
                        flexShrink: 0,
                        alignSelf: 'center',
                        color: active ? 'primary.main' : 'text.secondary',
                      }}
                    >
                      <module.icon fontSize="small" />
                    </ListItemIcon>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        opacity: collapsed ? 0 : 1,
                        transition: isDragging
                          ? 'none'
                          : collapsed
                          ? 'opacity 60ms ease'
                          : 'opacity 120ms ease 120ms',
                        pointerEvents: collapsed ? 'none' : 'auto',
                      }}
                    >
                      <ListItemText
                        primary={module.title}
                        primaryTypographyProps={{
                          fontWeight: active ? 700 : 500,
                          fontSize: titleFontSize,
                          color: active ? 'text.primary' : 'text.secondary',
                          lineHeight: 1.25,
                          whiteSpace: collapsed ? 'nowrap' : 'normal',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                        }}
                        sx={{
                          my: 0,
                          minWidth: 0,
                          flex: '1 1 auto',
                        }}
                      />
                      {compactHint && (
                        <Typography
                          variant="caption"
                          sx={{
                            ml: width < 280 ? 0.75 : 1.25,
                            fontFamily: 'monospace',
                            fontSize: '0.72rem',
                            color: active ? 'primary.light' : 'text.secondary',
                            fontWeight: 600,
                            flexShrink: 0,
                            alignSelf: 'center',
                          }}
                        >
                          {compactHint}
                        </Typography>
                      )}
                    </Box>
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        <Box
          sx={{
            px: 1.5,
            pt: 1.5,
            pb: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            overflow: 'hidden',
          }}
        >
          <Tooltip
            title={
              collapsed
                ? repeatCombo
                  ? `Repeat Last (${formatShortcutDisplay(repeatCombo)})`
                  : 'Repeat Last'
                : formatShortcutDisplay(repeatCombo) || ''
            }
            placement="right"
          >
            <Box sx={{ width: '100%' }}>
              <Button
                aria-label="Repeat Last"
                variant="outlined"
                onClick={onRepeat}
                disabled={running || !hasRun}
                fullWidth
                sx={{
                  borderRadius: 1.75,
                  fontWeight: 700,
                  minWidth: 0,
                  fontSize: buttonFontSize,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  px: 1.5,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <Replay fontSize="small" sx={{ flexShrink: 0, mr: collapsed ? 0 : 1 }} />
                <Box
                  component="span"
                  sx={{
                    minWidth: 0,
                    opacity: collapsed ? 0 : 1,
                    transition: isDragging
                      ? 'none'
                      : collapsed
                      ? 'opacity 60ms ease'
                      : 'opacity 120ms ease 120ms',
                    display: collapsed ? 'none' : 'inline-block',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Repeat Last
                </Box>
              </Button>
            </Box>
          </Tooltip>
          {collapsed ? (
            <Tooltip
              title={settingsCombo ? `Settings (${formatShortcutDisplay(settingsCombo)})` : 'Settings'}
              placement="right"
            >
              <IconButton
                aria-label="Settings"
                onClick={(e) => {
                  e.currentTarget?.blur();
                  onSettingsTabChange?.('general');
                  setSettingsOpen(true);
                }}
                sx={{
                  display: 'flex',
                  mx: 'auto',
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                <Settings fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              aria-label="Settings"
              variant="outlined"
              onClick={(e) => {
                e.currentTarget?.blur();
                onSettingsTabChange?.('general');
                setSettingsOpen(true);
              }}
              fullWidth
              startIcon={<Settings fontSize="small" sx={{ flexShrink: 0 }} />}
              sx={{
                borderRadius: 1.75,
                fontWeight: 700,
                minWidth: 0,
                fontSize: buttonFontSize,
                justifyContent: 'space-between',
                px: 1.75,
                py: 0.9,
                color: 'text.secondary',
                borderColor: 'divider',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  bgcolor: 'rgba(99, 102, 241, 0.08)',
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  opacity: collapsed ? 0 : 1,
                  transition: isDragging
                    ? 'none'
                    : collapsed
                    ? 'opacity 60ms ease'
                    : 'opacity 120ms ease 120ms',
                }}
              >
                <span>Settings</span>
                {settingsCombo && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      ml: 1.5,
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                      color: 'text.secondary',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {formatCompactShortcut(settingsCombo)}
                  </Typography>
                )}
              </Box>
            </Button>
          )}

          <SettingsDialog
            updater={updater}
            running={running}
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            selectedMod={selectedMod}
            settings={settings}
            onChange={onSettingsChange}
            shortcuts={shortcuts}
            onShortcutsChange={onShortcutsChange}
            initialTab={settingsTab}
          />
        </Box>
      </Box>
      {!collapsed && (
        <Box
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            e.preventDefault();
            try {
              window.getSelection()?.removeAllRanges();
            } catch {}
            dragging.current = true;
            setIsDragging(true);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            document.documentElement.style.cursor = 'col-resize';
            document.documentElement.style.userSelect = 'none';
            document.documentElement.style.webkitUserSelect = 'none';
          }}
          sx={{
            width: 4,
            flexShrink: 0,
            cursor: 'col-resize',
            bgcolor: isDragging ? 'primary.main' : 'divider',
            transition: isDragging ? 'none' : 'background-color 0.15s ease',
            '&:hover': { bgcolor: 'primary.main' },
            zIndex: 10,
          }}
        />
      )}
    </>
  );
}

export default memo(Sidebar);
