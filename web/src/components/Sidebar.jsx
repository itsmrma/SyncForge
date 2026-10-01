import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Tooltip, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Replay from '@mui/icons-material/Replay';
import Settings from '@mui/icons-material/Settings';
import modules from '../modules';
import SettingsPanel from './SettingsPanel';

export default function Sidebar({ selectedMod, onSelect, running, hasRun, onRepeat, settings, onSettingsChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(300);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    const move = event => {
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
      <Box component="aside" aria-label="Modules and settings" sx={{ width: collapsed ? 72 : width,
        flexShrink: 0, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
        <Box sx={{ p: 2, pb: 0, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && <Typography variant="h5" fontWeight="bold">SyncForge</Typography>}
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <IconButton aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(value => !value)}>
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </IconButton>
          </Tooltip>
        </Box>
        <List sx={{ flex: 1, overflowY: 'auto', px: collapsed ? 1 : 2, pt: 2 }}>
          {modules.map(module => (
            <ListItem disablePadding key={module.id}>
              <Tooltip title={collapsed ? module.title : ''} placement="right">
                <ListItemButton aria-label={module.title} selected={selectedMod.id === module.id} disabled={running}
                  onClick={() => onSelect(module)} sx={{ borderRadius: 2, mb: 1, px: collapsed ? 2 : undefined }}>
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40 }}><module.icon /></ListItemIcon>
                  {!collapsed && <ListItemText primary={module.title} primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }} />}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
        <Box sx={{ px: collapsed ? 1 : 2, pb: 2 }}>
          <Tooltip title={collapsed ? 'Repeat Last' : ''} placement="right">
            <span>
              <Button aria-label="Repeat Last" variant="outlined" onClick={onRepeat} disabled={running || !hasRun}
                fullWidth startIcon={collapsed ? null : <Replay />} sx={{ mb: 2, borderRadius: 2, fontWeight: 'bold', minWidth: 0 }}>
                {collapsed ? <Replay /> : 'Repeat Last'}
              </Button>
            </span>
          </Tooltip>
          {collapsed ? <Tooltip title="Settings" placement="right">
            <IconButton aria-label="Expand sidebar and show settings" onClick={() => { setCollapsed(false); setSettingsOpen(true); }}
              sx={{ display: 'flex', mx: 'auto' }}><Settings /></IconButton>
          </Tooltip> : <SettingsPanel settings={settings} onChange={onSettingsChange}
            expanded={settingsOpen} onToggle={() => setSettingsOpen(value => !value)} />}
        </Box>
      </Box>
      {!collapsed && <Box role="separator" aria-label="Resize sidebar" aria-orientation="vertical"
        onMouseDown={() => { dragging.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
        sx={{ width: 4, flexShrink: 0, cursor: 'col-resize', '&:hover': { bgcolor: 'primary.main' }, zIndex: 10 }} />}
    </>
  );
}
