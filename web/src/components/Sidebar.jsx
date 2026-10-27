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
      component="svg"
      viewBox="0 0 1024 1024"
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
    >
      <defs>
        <linearGradient id="sf-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#080C14" />
          <stop offset="50%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#05080E" />
        </linearGradient>
        <linearGradient id="sf-panel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="sf-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="sf-vtrack" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
        <linearGradient id="sf-atrack" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="sf-strack" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
      </defs>

      <rect width="1024" height="1024" rx="224" fill="url(#sf-bg)" />
      <rect x="36" y="36" width="952" height="952" rx="196" fill="none" stroke="url(#sf-border)" strokeWidth="12" />

      {/* Top & Bottom Filmstrip Sprockets */}
      <g fill="#334155" opacity="0.45">
        <rect x="180" y="140" width="60" height="44" rx="10" />
        <rect x="280" y="140" width="60" height="44" rx="10" />
        <rect x="380" y="140" width="60" height="44" rx="10" />
        <rect x="480" y="140" width="60" height="44" rx="10" />
        <rect x="580" y="140" width="60" height="44" rx="10" />
        <rect x="680" y="140" width="60" height="44" rx="10" />
        <rect x="780" y="140" width="60" height="44" rx="10" />

        <rect x="180" y="840" width="60" height="44" rx="10" />
        <rect x="280" y="840" width="60" height="44" rx="10" />
        <rect x="380" y="840" width="60" height="44" rx="10" />
        <rect x="480" y="840" width="60" height="44" rx="10" />
        <rect x="580" y="840" width="60" height="44" rx="10" />
        <rect x="680" y="840" width="60" height="44" rx="10" />
        <rect x="780" y="840" width="60" height="44" rx="10" />
      </g>

      {/* Timeline Editor Workstation Panel */}
      <rect x="150" y="216" width="724" height="592" rx="28" fill="url(#sf-panel)" stroke="#475569" strokeOpacity="0.3" strokeWidth="4" />

      {/* Track 1: Video Track (V1) */}
      <rect x="180" y="248" width="664" height="150" rx="16" fill="#0B1120" stroke="#334155" strokeOpacity="0.4" strokeWidth="2" />
      <rect x="194" y="260" width="280" height="126" rx="12" fill="url(#sf-vtrack)" />
      <rect x="210" y="274" width="70" height="98" rx="8" fill="#1E1B4B" opacity="0.6" />
      <polygon points="240,315 252,323 240,331" fill="#FFFFFF" opacity="0.8" />
      <rect x="290" y="274" width="70" height="98" rx="8" fill="#1E1B4B" opacity="0.6" />
      <polygon points="320,315 332,323 320,331" fill="#FFFFFF" opacity="0.8" />
      <rect x="370" y="274" width="70" height="98" rx="8" fill="#1E1B4B" opacity="0.6" />
      <polygon points="400,315 412,323 400,331" fill="#FFFFFF" opacity="0.8" />

      <rect x="484" y="260" width="344" height="126" rx="12" fill="url(#sf-vtrack)" opacity="0.85" />
      <rect x="500" y="274" width="70" height="98" rx="8" fill="#1E1B4B" opacity="0.6" />
      <polygon points="530,315 542,323 530,331" fill="#FFFFFF" opacity="0.8" />
      <rect x="580" y="274" width="70" height="98" rx="8" fill="#1E1B4B" opacity="0.6" />
      <polygon points="610,315 622,323 610,331" fill="#FFFFFF" opacity="0.8" />
      <rect x="660" y="274" width="70" height="98" rx="8" fill="#1E1B4B" opacity="0.6" />
      <polygon points="690,315 702,323 690,331" fill="#FFFFFF" opacity="0.8" />
      <rect x="740" y="274" width="70" height="98" rx="8" fill="#1E1B4B" opacity="0.6" />
      <polygon points="770,315 782,323 770,331" fill="#FFFFFF" opacity="0.8" />

      {/* Track 2: Audio Waveform Track (A1) */}
      <rect x="180" y="422" width="664" height="150" rx="16" fill="#0B1120" stroke="#334155" strokeOpacity="0.4" strokeWidth="2" />
      <rect x="194" y="434" width="634" height="126" rx="12" fill="#082F49" stroke="#0284C7" strokeOpacity="0.5" strokeWidth="2" />
      <g fill="url(#sf-atrack)">
        <rect x="212" y="482" width="10" height="30" rx="5" />
        <rect x="230" y="467" width="10" height="60" rx="5" />
        <rect x="248" y="455" width="10" height="84" rx="5" />
        <rect x="266" y="470" width="10" height="54" rx="5" />
        <rect x="284" y="460" width="10" height="74" rx="5" />
        <rect x="302" y="447" width="10" height="100" rx="5" />
        <rect x="320" y="465" width="10" height="64" rx="5" />
        <rect x="338" y="450" width="10" height="94" rx="5" />
        <rect x="356" y="462" width="10" height="70" rx="5" />
        <rect x="374" y="472" width="10" height="50" rx="5" />
        <rect x="392" y="452" width="10" height="90" rx="5" />
        <rect x="410" y="445" width="10" height="104" rx="5" />
        <rect x="428" y="460" width="10" height="74" rx="5" />
        <rect x="446" y="468" width="10" height="58" rx="5" />
        <rect x="464" y="454" width="10" height="86" rx="5" />
        <rect x="482" y="442" width="10" height="110" rx="5" />
        <rect x="500" y="450" width="10" height="94" rx="5" />
        <rect x="518" y="440" width="10" height="114" rx="5" />
        <rect x="536" y="448" width="10" height="98" rx="5" />
        <rect x="554" y="458" width="10" height="78" rx="5" />
        <rect x="572" y="445" width="10" height="104" rx="5" />
        <rect x="590" y="465" width="10" height="64" rx="5" />
        <rect x="608" y="452" width="10" height="90" rx="5" />
        <rect x="626" y="460" width="10" height="74" rx="5" />
        <rect x="644" y="470" width="10" height="54" rx="5" />
        <rect x="662" y="455" width="10" height="84" rx="5" />
        <rect x="680" y="448" width="10" height="98" rx="5" />
        <rect x="698" y="464" width="10" height="66" rx="5" />
        <rect x="716" y="452" width="10" height="90" rx="5" />
        <rect x="734" y="468" width="10" height="58" rx="5" />
        <rect x="752" y="458" width="10" height="78" rx="5" />
        <rect x="770" y="472" width="10" height="50" rx="5" />
        <rect x="788" y="482" width="10" height="30" rx="5" />
      </g>

      {/* Track 3: Subtitle Track (S1) */}
      <rect x="180" y="596" width="664" height="110" rx="16" fill="#0B1120" stroke="#334155" strokeOpacity="0.4" strokeWidth="2" />
      <rect x="230" y="612" width="260" height="78" rx="12" fill="url(#sf-strack)" />
      <rect x="250" y="632" width="160" height="14" rx="7" fill="#064E3B" opacity="0.6" />
      <rect x="250" y="654" width="200" height="14" rx="7" fill="#064E3B" opacity="0.6" />

      <rect x="520" y="612" width="280" height="78" rx="12" fill="url(#sf-strack)" opacity="0.9" />
      <rect x="540" y="632" width="200" height="14" rx="7" fill="#064E3B" opacity="0.6" />
      <rect x="540" y="654" width="150" height="14" rx="7" fill="#064E3B" opacity="0.6" />

      {/* Video Timecode Bar */}
      <rect x="180" y="726" width="664" height="60" rx="12" fill="#090D16" stroke="#1E293B" strokeWidth="2" />

      {/* Playhead & Sync Cursor */}
      <line x1="523" y1="216" x2="523" y2="786" stroke="#38BDF8" strokeWidth="6" opacity="0.8" />
      <line x1="523" y1="216" x2="523" y2="786" stroke="#FFFFFF" strokeWidth="3" />
      <polygon points="503,196 543,196 543,222 523,242 503,222" fill="#38BDF8" />
      <polygon points="507,200 539,200 539,220 523,236 507,220" fill="#FFFFFF" />
      <circle cx="523" cy="584" r="14" fill="#F59E0B" opacity="0.9" />
      <path d="M 523 560 Q 523 584 547 584 Q 523 584 523 608 Q 523 584 499 584 Q 523 584 523 560 Z" fill="#FFFFFF" />
    </Box>
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
