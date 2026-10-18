import { useEffect, useRef, useState } from 'react';
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
import GraphicEq from '@mui/icons-material/GraphicEq';
import modules from '../modules';
import SettingsDialog from './SettingsDialog';
import { DEFAULT_SHORTCUTS, formatCompactShortcut } from '../shortcuts';

export default function Sidebar({
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
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(300);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);

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
      if (dragging.current) setWidth(Math.min(Math.max(event.clientX, 250), 600));
    };
    const stop = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
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

  return (
    <>
      <Box
        component="aside"
        aria-label="Modules and settings"
        sx={{
          width: collapsed ? 72 : width,
          flexShrink: 0,
          bgcolor: '#0D111A',
          boxShadow: collapsed ? 'inset -1px 0 0 rgba(148, 163, 184, 0.10)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          overflowX: 'hidden',
          transition: isDragging ? 'none' : 'width 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: isDragging ? 'auto' : 'width',
        }}
      >
        <Box
          sx={{
            p: 2,
            pb: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            height: 60,
            boxSizing: 'border-box',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              minWidth: 150,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              opacity: collapsed ? 0 : 1,
              transition: isDragging ? 'none' : 'opacity 140ms ease',
              pointerEvents: collapsed ? 'none' : 'auto',
            }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #38BDF8 0%, #6366F1 60%, #A855F7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              }}
            >
              <GraphicEq fontSize="small" />
            </Box>
            <Typography variant="h5" fontWeight="800" noWrap>
              SyncForge
            </Typography>
          </Box>
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <IconButton
              size="small"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((value) => !value)}
              sx={{
                color: 'text.secondary',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                borderRadius: 1.5,
                flexShrink: 0,
                ml: collapsed ? 'auto' : 0,
                mr: collapsed ? 'auto' : 0,
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
                        ? `${module.title} (${modCombo})`
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
                      px: 1.5,
                      position: 'relative',
                      border: '1px solid',
                      borderColor: active
                        ? 'rgba(99, 102, 241, 0.4)'
                        : 'transparent',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
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
                        minWidth: 36,
                        flexShrink: 0,
                        color: active ? '#818CF8' : 'text.secondary',
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
                        minWidth: 210,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        opacity: collapsed ? 0 : 1,
                        transition: isDragging ? 'none' : 'opacity 140ms ease',
                        pointerEvents: collapsed ? 'none' : 'auto',
                      }}
                    >
                      <ListItemText
                        primary={module.title}
                        primaryTypographyProps={{
                          fontWeight: active ? 700 : 500,
                          fontSize: '0.88rem',
                          color: active ? 'text.primary' : 'text.secondary',
                          noWrap: true,
                        }}
                        sx={{ my: 0 }}
                      />
                      {compactHint && (
                        <Typography
                          variant="caption"
                          sx={{
                            ml: 1,
                            fontFamily: 'monospace',
                            fontSize: '0.66rem',
                            color: active ? '#A5B4FC' : 'rgba(148, 163, 184, 0.45)',
                            fontWeight: 600,
                            flexShrink: 0,
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
            borderTop: '1px solid rgba(148, 163, 184, 0.08)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          <Tooltip
            title={
              collapsed
                ? repeatCombo
                  ? `Repeat Last (${repeatCombo})`
                  : 'Repeat Last'
                : repeatCombo || ''
            }
            placement="right"
          >
            <span>
              <Button
                aria-label="Repeat Last"
                variant="outlined"
                onClick={onRepeat}
                disabled={running || !hasRun}
                fullWidth
                sx={{
                  mb: 1.5,
                  borderRadius: 1.75,
                  fontWeight: 700,
                  minWidth: 0,
                  fontSize: '0.84rem',
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
                    minWidth: 90,
                    opacity: collapsed ? 0 : 1,
                    transition: isDragging ? 'none' : 'opacity 140ms ease',
                    display: collapsed ? 'none' : 'inline-block',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Repeat Last
                </Box>
              </Button>
            </span>
          </Tooltip>
          {collapsed ? (
            <Tooltip
              title={settingsCombo ? `Settings (${settingsCombo})` : 'Settings'}
              placement="right"
            >
              <IconButton
                aria-label="Expand sidebar and show settings"
                onClick={() => {
                  setCollapsed(false);
                  onSettingsTabChange?.('general');
                  setSettingsOpen(true);
                }}
                sx={{
                  display: 'flex',
                  mx: 'auto',
                  color: 'text.secondary',
                  '&:hover': { color: '#818CF8' },
                }}
              >
                <Settings fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              aria-label="Settings"
              variant="outlined"
              onClick={() => {
                onSettingsTabChange?.('general');
                setSettingsOpen(true);
              }}
              fullWidth
              startIcon={<Settings fontSize="small" sx={{ flexShrink: 0 }} />}
              sx={{
                borderRadius: 1.75,
                fontWeight: 700,
                minWidth: 0,
                fontSize: '0.84rem',
                justifyContent: 'space-between',
                px: 1.75,
                py: 0.9,
                color: 'text.secondary',
                borderColor: 'rgba(148, 163, 184, 0.16)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: '#818CF8',
                  color: '#818CF8',
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
                  minWidth: 170,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  opacity: collapsed ? 0 : 1,
                  transition: isDragging ? 'none' : 'opacity 140ms ease',
                }}
              >
                <span>Settings</span>
                {settingsCombo && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.66rem',
                      color: 'rgba(148, 163, 184, 0.55)',
                      fontWeight: 700,
                    }}
                  >
                    {formatCompactShortcut(settingsCombo)}
                  </Typography>
                )}
              </Box>
            </Button>
          )}

          <SettingsDialog
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
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          sx={{
            width: 4,
            flexShrink: 0,
            cursor: 'col-resize',
            bgcolor: 'rgba(148, 163, 184, 0.08)',
            transition: 'background-color 0.15s ease',
            '&:hover': { bgcolor: 'primary.main' },
            zIndex: 10,
          }}
        />
      )}
    </>
  );
}
