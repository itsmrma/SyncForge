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
import ChevronRight from '@mui/icons-material/ChevronRight';
import Replay from '@mui/icons-material/Replay';
import Settings from '@mui/icons-material/Settings';
import GraphicEq from '@mui/icons-material/GraphicEq';
import modules from '../modules';
import SettingsDialog from './SettingsDialog';

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
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(300);
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
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
        }}
      >
        <Box
          sx={{
            p: 2,
            pb: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
          }}
        >
          {!collapsed && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
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
          )}
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <IconButton
              size="small"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((value) => !value)}
              sx={{
                color: 'text.secondary',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                borderRadius: 1.5,
              }}
            >
              {collapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        <List sx={{ flex: 1, overflowY: 'auto', px: collapsed ? 1 : 1.5, pt: 1.5 }}>
          {modules.map((module, index) => {
            const active = selectedMod.id === module.id;
            return (
              <ListItem disablePadding key={module.id}>
                <Tooltip title={collapsed ? `${module.title} (Ctrl+${index + 1})` : ''} placement="right">
                  <ListItemButton
                    aria-label={module.title}
                    selected={active}
                    disabled={running}
                    onClick={() => onSelect(module)}
                    sx={{
                      borderRadius: 1.75,
                      mb: 0.6,
                      py: 1,
                      px: collapsed ? 2 : 1.5,
                      position: 'relative',
                      border: '1px solid',
                      borderColor: active
                        ? 'rgba(99, 102, 241, 0.4)'
                        : 'transparent',
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
                        minWidth: collapsed ? 0 : 36,
                        color: active ? '#818CF8' : 'text.secondary',
                      }}
                    >
                      <module.icon fontSize="small" />
                    </ListItemIcon>
                    {!collapsed && (
                      <>
                        <ListItemText
                          primary={module.title}
                          primaryTypographyProps={{
                            fontWeight: active ? 700 : 500,
                            fontSize: '0.88rem',
                            color: active ? 'text.primary' : 'text.secondary',
                            noWrap: true,
                          }}
                        />
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
                          {`^${index + 1}`}
                        </Typography>
                      </>
                    )}
                  </ListItemButton>
                </Tooltip>
              </ListItem>
            );
          })}
        </List>

        <Box
          sx={{
            px: collapsed ? 1 : 1.5,
            pt: 1.5,
            pb: 2,
            borderTop: '1px solid rgba(148, 163, 184, 0.08)',
          }}
        >
          <Tooltip title={collapsed ? 'Repeat Last (Ctrl+Shift+R)' : 'Ctrl+Shift+R'} placement="right">
            <span>
              <Button
                aria-label="Repeat Last"
                variant="outlined"
                onClick={onRepeat}
                disabled={running || !hasRun}
                fullWidth
                startIcon={collapsed ? null : <Replay fontSize="small" />}
                sx={{
                  mb: 1.5,
                  borderRadius: 1.75,
                  fontWeight: 700,
                  minWidth: 0,
                  fontSize: '0.84rem',
                }}
              >
                {collapsed ? <Replay fontSize="small" /> : 'Repeat Last'}
              </Button>
            </span>
          </Tooltip>
          {collapsed ? (
            <Tooltip title="Settings (Ctrl+,)" placement="right">
              <IconButton
                aria-label="Expand sidebar and show settings"
                onClick={() => {
                  setCollapsed(false);
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
              onClick={() => setSettingsOpen(true)}
              fullWidth
              startIcon={<Settings fontSize="small" />}
              sx={{
                borderRadius: 1.75,
                fontWeight: 700,
                minWidth: 0,
                fontSize: '0.84rem',
                justifyContent: 'flex-start',
                px: 1.75,
                py: 0.9,
                color: 'text.secondary',
                borderColor: 'rgba(148, 163, 184, 0.16)',
                '&:hover': {
                  borderColor: '#818CF8',
                  color: '#818CF8',
                  bgcolor: 'rgba(99, 102, 241, 0.08)',
                },
              }}
            >
              Settings
            </Button>
          )}

          <SettingsDialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            selectedMod={selectedMod}
            settings={settings}
            onChange={onSettingsChange}
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
