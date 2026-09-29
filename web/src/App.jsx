import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Button, TextField, FormControlLabel, Checkbox, Paper } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { FormatListBulleted, Flag, Subtitles, Sync, Waves, MergeType, PlayArrow } from '@mui/icons-material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#D0BCFF' },
    background: { default: '#141218', paper: '#211F26' },
    text: { primary: '#E6E0E9', secondary: '#CAC4D0' }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  }
});

const modules = [
  { id: 'stream_manager', title: 'Stream Manager', desc: 'Batch-remove unwanted audio or subtitle tracks. The operation is lossless and instantaneous.', icon: <FormatListBulleted /> },
  { id: 'set_default', title: 'Set Default & Forced', desc: 'Modify the Default and Forced track flags across an entire batch of MKV files.', icon: <Flag /> },
  { id: 'sync_subs', title: 'Sync External Subtitles', desc: 'Automatically align your .srt files to the video\'s audio track. Leverages FFsubsync.', icon: <Subtitles /> },
  { id: 'sync_subs_mkv', title: 'Sync Subs from MKV', desc: 'Automatically extracts subtitles from a Source MKV and realigns them to the audio of a Target MKV.', icon: <Sync /> },
  { id: 'injection', title: 'WaveSync Injection', desc: 'Automatically calculates the exact delay between the audio of two different video files. Syncs and injects.', icon: <Waves /> },
  { id: 'custom_merge', title: 'Custom Track Merge', desc: 'Combine specific tracks from two different batches of videos to create the ultimate hybrid file.', icon: <MergeType /> }
];

export default function App() {
  const [selectedMod, setSelectedMod] = useState(modules[0]);
  const [terminal, setTerminal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  
  const [settings, setSettings] = useState({
    max_offset: 1,
    auto_audio: true,
    auto_subs: true
  });

  const terminalEndRef = useRef(null);

  useEffect(() => {
    // Expose functions to Python
    if (window.eel) {
        window.eel.expose(append_terminal, 'append_terminal');
        window.eel.expose(ask_input, 'ask_input');
        window.eel.expose(ask_matcher, 'ask_matcher');
    }
  }, []);

  const append_terminal = (text) => {
    setTerminal(prev => {
        const next = prev + text;
        // Keep terminal from getting too huge
        if (next.length > 50000) return next.slice(next.length - 50000);
        return next;
    });
    if (terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView();
    }
  };

  const ask_input = (prompt_text) => {
    const res = window.prompt(prompt_text);
    return res || "";
  };

  const ask_matcher = (targets, sources) => {
    return new Promise((resolve) => {
        const limit = Math.min(targets.length, sources.length);
        const pairs = [];
        for (let i = 0; i < limit; i++) {
            pairs.push([targets[i], sources[i]]);
        }
        let msg = `Auto-paired ${limit} files. Proceed?\n\nFirst pair:\nTarget: ${targets[0] || 'N/A'}\nSource: ${sources[0] || 'N/A'}`;
        if (window.confirm(msg)) {
            resolve(pairs);
        } else {
            resolve([]);
        }
    });
  };

  const handleRun = async () => {
    setIsRunning(true);
    setShowTerminal(true);
    if (window.eel) {
        await window.eel.run_module(selectedMod.id, settings)();
    } else {
        append_terminal("Eel is not connected. Running in dev mode?\n");
    }
    setIsRunning(false);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Box sx={{ width: 300, bgcolor: 'background.paper', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h5" fontWeight="bold">SyncForge</Typography>
          <List>
            {modules.map((m) => (
              <ListItem disablePadding key={m.id}>
                <ListItemButton 
                  selected={selectedMod.id === m.id} 
                  onClick={() => setSelectedMod(m)}
                  sx={{ borderRadius: 2, mb: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>{m.icon}</ListItemIcon>
                  <ListItemText primary={m.title} primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          
          <Box sx={{ mt: 'auto', p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Settings</Typography>
            <TextField 
              label="FFsubsync Max Offset (s)" 
              type="number" 
              size="small" 
              fullWidth
              value={settings.max_offset}
              onChange={e => setSettings({...settings, max_offset: e.target.value})}
              sx={{ mb: 2 }}
            />
            <FormControlLabel 
              control={<Checkbox checked={settings.auto_audio} onChange={e => setSettings({...settings, auto_audio: e.target.checked})} />} 
              label={<Typography fontSize="0.85rem">Auto-sync Audio</Typography>} 
            />
            <FormControlLabel 
              control={<Checkbox checked={settings.auto_subs} onChange={e => setSettings({...settings, auto_subs: e.target.checked})} />} 
              label={<Typography fontSize="0.85rem">Auto-sync Subs</Typography>} 
            />
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 4, bgcolor: 'background.default' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              style={{ flex: 1 }}
            >
              <Typography variant="h3" fontWeight="800" sx={{ mb: 2 }}>{selectedMod.title}</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600, lineHeight: 1.6 }}>
                {selectedMod.desc}
              </Typography>
              
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<PlayArrow />}
                onClick={handleRun}
                disabled={isRunning}
                sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 'bold' }}
              >
                {isRunning ? 'Running...' : 'Launch Module'}
              </Button>
            </motion.div>
          </AnimatePresence>

          <Box sx={{ height: showTerminal ? 250 : 0, transition: 'height 0.3s ease', overflow: 'hidden', mt: 2, display: 'flex', flexDirection: 'column' }}>
             <Paper sx={{ flex: 1, bgcolor: '#1D1B20', color: '#D0BCFF', p: 2, fontFamily: 'monospace', overflowY: 'auto', fontSize: '0.85rem', border: '1px solid #36343B', borderRadius: 2 }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{terminal}</pre>
                <div ref={terminalEndRef} />
             </Paper>
          </Box>
          <Button onClick={() => setShowTerminal(!showTerminal)} sx={{ alignSelf: 'flex-start', mt: 1, color: '#CAC4D0' }}>
            {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
          </Button>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
