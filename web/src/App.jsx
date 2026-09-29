import React, { useState, useEffect, useRef } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Button, TextField, FormControlLabel, Checkbox, Paper, Dialog, DialogTitle, DialogContent, DialogActions, Accordion, AccordionSummary, AccordionDetails, Tooltip } from '@mui/material';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import Flag from '@mui/icons-material/Flag';
import Subtitles from '@mui/icons-material/Subtitles';
import Sync from '@mui/icons-material/Sync';
import Waves from '@mui/icons-material/Waves';
import MergeType from '@mui/icons-material/MergeType';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Replay from '@mui/icons-material/Replay';
import DragHandle from '@mui/icons-material/DragHandle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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
  { id: 'stream_manager', title: 'Stream Manager', desc: 'Batch-remove unwanted audio or subtitle tracks. The operation is lossless and instantaneous.', icon: <FormatListBulleted />, needs: ['video', 'output'], labels: ['Video Folder', '', 'Output Folder'] },
  { id: 'set_default', title: 'Set Default & Forced', desc: 'Modify the Default and Forced track flags across an entire batch of MKV files.', icon: <Flag />, needs: ['video'], labels: ['Video Folder', '', ''] },
  { id: 'sync_subs', title: 'Sync External Subtitles', desc: 'Automatically align your .srt files to the video\'s audio track. Leverages FFsubsync.', icon: <Subtitles />, needs: ['video', 'sub', 'output'], labels: ['Video Folder', 'Subtitle Folder', 'Output Folder'] },
  { id: 'sync_subs_mkv', title: 'Sync Subs from MKV', desc: 'Automatically extracts subtitles from a Source MKV and realigns them to the audio of a Target MKV.', icon: <Sync />, needs: ['video', 'sub', 'output'], labels: ['Target Video Folder', 'Source Video Folder', 'Output Folder'] },
  { id: 'injection', title: 'WaveSync Injection', desc: 'Automatically calculates the exact delay between the audio of two different video files. Syncs and injects.', icon: <Waves />, needs: ['video', 'sub', 'output'], labels: ['Target Folder (High Quality)', 'Source Folder (Extract audio/subs)', 'Output Folder'] },
  { id: 'custom_merge', title: 'Custom Track Merge', desc: 'Combine specific tracks from two different batches of videos to create the ultimate hybrid file.', icon: <MergeType />, needs: ['video', 'sub', 'output'], labels: ['Folder A (Base Video)', 'Folder B (Additional Audio/Subs)', 'Output Folder'] }
];

export default function App() {
  const [selectedMod, setSelectedMod] = useState(modules[0]);
  const [terminal, setTerminal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  
  const [paths, setPaths] = useState({
    video: '',
    sub: '',
    output: ''
  });
  
  const [settings, setSettings] = useState({
    max_offset: 1,
    enable_max_offset: true,
    auto_audio: true,
    auto_subs: true
  });

  const [matcherState, setMatcherState] = useState({ open: false, targets: [], sources: [], resolve: null });
  const [reorderSources, setReorderSources] = useState([]);

  const terminalEndRef = useRef(null);

  useEffect(() => {
    // Expose functions for Python to call
    window.eel = window.eel || {};
    window.eel.append_terminal = append_terminal;
    window.eel.ask_input = ask_input;
    window.eel.ask_matcher = ask_matcher;
  }, []);

  const append_terminal = (text) => {
    setTerminal(prev => {
        const next = prev + text;
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
        // Need to make sources unique for Reorder key prop
        const uniqueSources = sources.map((s, i) => ({ id: i.toString(), path: s }));
        setReorderSources(uniqueSources);
        setMatcherState({ open: true, targets, sources: uniqueSources, resolve });
    });
  };

  const handleMatcherConfirm = () => {
    const limit = Math.min(matcherState.targets.length, reorderSources.length);
    const pairs = [];
    for (let i = 0; i < limit; i++) {
        pairs.push([matcherState.targets[i], reorderSources[i].path]);
    }
    matcherState.resolve(pairs);
    setMatcherState({ open: false, targets: [], sources: [], resolve: null });
  };

  const handleMatcherCancel = () => {
    matcherState.resolve([]);
    setMatcherState({ open: false, targets: [], sources: [], resolve: null });
  };

  const handleRun = async (repeat = false) => {
    setIsRunning(true);
    setShowTerminal(true);
    if (window.pywebview && window.pywebview.api) {
        await window.pywebview.api.run_module(selectedMod.id, settings, paths, repeat);
    } else {
        append_terminal("Webview API is not connected. Running in dev mode?\\n");
    }
    setIsRunning(false);
  };

  const handlePickFolder = async (key) => {
    if (window.pywebview && window.pywebview.api) {
        const folder = await window.pywebview.api.pick_folder();
        if (folder) {
            setPaths(prev => ({ ...prev, [key]: folder }));
        }
    }
  };

  const formatPath = (p) => {
      const parts = p.split(/[\\/]/);
      return parts[parts.length - 1];
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Box sx={{ width: 300, bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, pb: 0 }}>
            <Typography variant="h5" fontWeight="bold">SyncForge</Typography>
          </Box>
          
          <List sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 2 }}>
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

          <Box sx={{ px: 2, pb: 2 }}>
            <Button 
              variant="outlined" 
              startIcon={<Replay />}
              onClick={() => handleRun(true)}
              disabled={isRunning}
              fullWidth
              sx={{ mb: 2, borderRadius: 2, fontWeight: 'bold' }}
            >
              Repeat Last
            </Button>
            
            <Accordion disableGutters elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Settings</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, display: 'flex', flexDirection: 'column' }}>
                <FormControlLabel 
                  control={<Checkbox checked={settings.enable_max_offset} onChange={e => setSettings({...settings, enable_max_offset: e.target.checked})} />} 
                  label={<Typography fontSize="0.85rem">Enable Max Offset limit</Typography>} 
                />
                <TextField 
                  label="FFsubsync Max Offset (s)" 
                  type="number" 
                  size="small" 
                  fullWidth
                  disabled={!settings.enable_max_offset}
                  value={settings.max_offset}
                  onChange={e => setSettings({...settings, max_offset: e.target.value})}
                  sx={{ mb: 2, mt: 1 }}
                />
                <FormControlLabel 
                  control={<Checkbox checked={settings.auto_audio} onChange={e => setSettings({...settings, auto_audio: e.target.checked})} />} 
                  label={<Typography fontSize="0.85rem">Auto-sync Audio</Typography>} 
                />
                <FormControlLabel 
                  control={<Checkbox checked={settings.auto_subs} onChange={e => setSettings({...settings, auto_subs: e.target.checked})} />} 
                  label={<Typography fontSize="0.85rem">Auto-sync Subs</Typography>} 
                />
              </AccordionDetails>
            </Accordion>
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

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4, maxWidth: 600 }}>
                {selectedMod.needs.includes('video') && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField 
                      label={selectedMod.labels[0]} 
                      value={paths.video} 
                      onChange={(e) => setPaths(p => ({...p, video: e.target.value}))}
                      fullWidth 
                      size="small" 
                    />
                    <Button variant="outlined" onClick={() => handlePickFolder('video')}>Browse</Button>
                  </Box>
                )}
                {selectedMod.needs.includes('sub') && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField 
                      label={selectedMod.labels[1]} 
                      value={paths.sub} 
                      onChange={(e) => setPaths(p => ({...p, sub: e.target.value}))}
                      fullWidth 
                      size="small" 
                    />
                    <Button variant="outlined" onClick={() => handlePickFolder('sub')}>Browse</Button>
                  </Box>
                )}
                {selectedMod.needs.includes('output') && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField 
                      label={selectedMod.labels[2]} 
                      value={paths.output} 
                      onChange={(e) => setPaths(p => ({...p, output: e.target.value}))}
                      fullWidth 
                      size="small" 
                      placeholder="Leave empty to use Video Folder"
                    />
                    <Button variant="outlined" onClick={() => handlePickFolder('output')}>Browse</Button>
                  </Box>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button 
                    variant="contained" 
                    size="large" 
                    startIcon={<PlayArrow />}
                    onClick={() => handleRun(false)}
                    disabled={isRunning}
                    sx={{ borderRadius: 8, px: 4, py: 1.5, fontWeight: 'bold' }}
                  >
                    {isRunning ? 'Running...' : 'Launch Module'}
                  </Button>
              </Box>
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

      {/* Matcher Dialog */}
      <Dialog open={matcherState.open} maxWidth="xl" fullWidth>
        <DialogTitle>Pairing Screen (Drag & Drop)</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Drag the source files on the right to match the correct target files on the left.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Targets</Typography>
                <List dense sx={{ p: 0 }}>
                    {matcherState.targets.map((t, idx) => (
                        <ListItem key={idx} sx={{ bgcolor: 'rgba(255,255,255,0.05)', mb: 1, borderRadius: 1, height: 48, p: 1, overflow: 'hidden' }}>
                            <Tooltip title={formatPath(t)} placement="left" arrow>
                              <Typography variant="body2" noWrap>{formatPath(t)}</Typography>
                            </Tooltip>
                        </ListItem>
                    ))}
                </List>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Sources (Drag to reorder)</Typography>
                <Reorder.Group axis="y" values={reorderSources} onReorder={setReorderSources} style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                    {reorderSources.map((s, idx) => (
                        <Reorder.Item key={s.id} value={s} style={{ marginBottom: 8, height: 48, cursor: 'grab' }}>
                            <Paper sx={{ display: 'flex', alignItems: 'center', p: 1, bgcolor: 'primary.dark', color: 'primary.contrastText', height: '100%', overflow: 'hidden' }}>
                                <DragHandle sx={{ mr: 1, opacity: 0.7, flexShrink: 0 }} />
                                <Tooltip title={formatPath(s.path)} placement="right" arrow>
                                  <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{formatPath(s.path)}</Typography>
                                </Tooltip>
                            </Paper>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMatcherCancel} color="error">Cancel</Button>
          <Button onClick={handleMatcherConfirm} variant="contained">Confirm Pairing</Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
