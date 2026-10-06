import { useState, useEffect, useRef } from 'react';
import { ThemeProvider, CssBaseline, Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import Terminal from './components/Terminal';
import InputDialog from './components/InputDialog';
import darkTheme from './theme';
import modules from './modules';
import Stop from '@mui/icons-material/Stop';
import { motion, AnimatePresence } from 'framer-motion';
import PlayArrow from '@mui/icons-material/PlayArrow';
import MatcherDialog from './components/MatcherDialog';
import Sidebar from './components/Sidebar';
import PathInput from './components/PathInput';

export default function App() {
  const [selectedMod, setSelectedMod] = useState(modules[0]);
  const [terminal, setTerminal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [inputRequest, setInputRequest] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [notice, setNotice] = useState(null);
  const [hasRun, setHasRun] = useState(false);
  const runInFlight = useRef(false);
  
  const [paths, setPaths] = useState({
    video: '',
    sub: '',
    output: ''
  });
  
  const [settings, setSettings] = useState({
    max_offset: 1,
    enable_max_offset: false,
    auto_audio: true,
    auto_subs: true,
    notify_on_finish: true
  });

  const [matcherState, setMatcherState] = useState({ open: false, targets: [], sources: [], resolve: null });
  const [reorderSources, setReorderSources] = useState([]);
  
  const followTerminalRef = useRef(true);

  const append_terminal = (text) => {
    setTerminal(prev => {
        const next = prev + text;
        // Preserve the text being read while automatic scrolling is paused.
        if (next.length > 50000 && followTerminalRef.current) return next.slice(next.length - 50000);
        return next;
    });
  };

  const ask_input = (request, callback_id) => {
    setInputRequest({ ...request, callback_id });
  };

  const cancel_requests = () => {
    setInputRequest(null);
    setMatcherState({ open: false, targets: [], sources: [], resolve: null });
  };

  const ask_matcher = (targets, sources, callback_id) => {
    const uniqueSources = sources.map((s, i) => ({ id: i.toString(), path: s }));
    setReorderSources(uniqueSources);
    
    const resolveAndNotify = async (res, sourceOrder) => {
        if (window.pywebview && window.pywebview.api) {
            if (sourceOrder) await window.pywebview.api.resolve_matcher(callback_id, res, sourceOrder);
            else await window.pywebview.api.resolve_matcher(callback_id, res);
        }
    };
    
    setMatcherState({ open: true, targets, sources: uniqueSources, resolve: resolveAndNotify });
  };

  useEffect(() => {
    // Expose functions for Python to call
    window.frontend_api = window.frontend_api || {};
    window.frontend_api.append_terminal = append_terminal;
    window.frontend_api.ask_input = ask_input;
    window.frontend_api.ask_matcher = ask_matcher;
    window.frontend_api.cancel_requests = cancel_requests;
    return () => {
      delete window.frontend_api.append_terminal;
      delete window.frontend_api.ask_input;
      delete window.frontend_api.ask_matcher;
      delete window.frontend_api.cancel_requests;
    };
  }, []);

  const handleMatcherConfirm = () => {
    const limit = Math.min(matcherState.targets.length, reorderSources.length);
    const pairs = [];
    for (let i = 0; i < limit; i++) {
        pairs.push([matcherState.targets[i], reorderSources[i].path]);
    }
    matcherState.resolve(pairs, reorderSources.map(source => source.path));
    setMatcherState({ open: false, targets: [], sources: [], resolve: null });
  };

  const handleMatcherCancel = () => {
    matcherState.resolve([]);
    setMatcherState({ open: false, targets: [], sources: [], resolve: null });
  };

  const handleRun = async (repeat = false) => {
    if (runInFlight.current) return;
    runInFlight.current = true;
    setIsRunning(true);
    setIsStopping(false);
    setShowTerminal(true);
    setNotice(null);
    try {
      if (window.pywebview && window.pywebview.api) {
        const result = await window.pywebview.api.run_module(selectedMod.id, settings, paths, repeat);
        const severity = result?.status === 'ok' ? 'success' :
          result?.status === 'warning' ? 'warning' : result?.status === 'cancelled' ? 'info' : 'error';
        setNotice({ severity, message: result?.message || 'The task returned no result. Check the terminal.' });
        if (result && result.status !== 'busy') setHasRun(true);
      } else {
        append_terminal("Webview API is not connected. Running in dev mode?\n");
        setNotice({ severity: 'error', message: 'The desktop backend is not connected.' });
      }
    } catch (error) {
      const message = error.message || String(error);
      append_terminal(`\n[ERROR] ${message}\n`);
      setNotice({ severity: 'error', message });
    } finally {
      runInFlight.current = false;
      setIsRunning(false);
      setIsStopping(false);
      cancel_requests();
    }
  };

  const handleStop = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      const result = await window.pywebview.api.stop_task();
      if (result?.status === 'idle') setIsStopping(false);
    } catch (error) {
      setIsStopping(false);
      setNotice({ severity: 'error', message: error.message || String(error) });
    }
  };

  const resolveInput = async value => {
    await window.pywebview.api.resolve_input(inputRequest.callback_id, value);
    setInputRequest(current => current?.callback_id === inputRequest.callback_id ? null : current);
  };

  const downloadTerminalLogs = () => {
    const blob = new Blob([terminal], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syncforge_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePickPath = async (key, kind, mediaType) => {
    if (window.pywebview && window.pywebview.api) {
        try {
          const path = kind === 'file' ? await window.pywebview.api.pick_file(mediaType) :
            await window.pywebview.api.pick_folder();
          if (path) setPaths(prev => ({ ...prev, [key]: path }));
        } catch (error) {
          setNotice({ severity: 'error', message: error.message || String(error) });
        }
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar selectedMod={selectedMod} onSelect={setSelectedMod} running={isRunning}
          hasRun={hasRun} onRepeat={() => handleRun(true)} settings={settings} onSettingsChange={setSettings} />

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', p: 4, bgcolor: 'background.default' }}>
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
                  <PathInput label={selectedMod.labels[0]} value={paths.video} mediaType="video" disabled={isRunning}
                    onChange={video => setPaths(p => ({ ...p, video }))}
                    onPick={(kind, type) => handlePickPath('video', kind, type)} />
                )}
                {selectedMod.needs.includes('sub') && (
                  <PathInput label={selectedMod.labels[1]} value={paths.sub} disabled={isRunning}
                    mediaType={selectedMod.id === 'sync_subs' ? 'subtitles' : 'video'}
                    onChange={sub => setPaths(p => ({ ...p, sub }))}
                    onPick={(kind, type) => handlePickPath('sub', kind, type)} />
                )}
                {selectedMod.needs.includes('output') && (
                  <PathInput label={selectedMod.labels[2]} value={paths.output} disabled={isRunning}
                    placeholder="Leave empty to use the target's folder"
                    onChange={output => setPaths(p => ({ ...p, output }))}
                    onPick={kind => handlePickPath('output', kind)} />
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
                  {isRunning && <Button variant="outlined" color="error" size="large" startIcon={<Stop />}
                    onClick={handleStop} disabled={isStopping} sx={{ borderRadius: 8, px: 3 }}>
                    {isStopping ? 'Stopping...' : 'Stop task'}
                  </Button>}
              </Box>
            </motion.div>
          </AnimatePresence>

          <Box sx={{ height: showTerminal ? 250 : 0, transition: 'height 0.3s ease', overflow: 'hidden', mt: 2, display: 'flex', flexDirection: 'column' }}>
             <Terminal text={terminal} visible={showTerminal} onFollowChange={following => { followTerminalRef.current = following; }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, alignSelf: 'flex-start' }}>
            <Button onClick={() => setShowTerminal(!showTerminal)} sx={{ color: '#CAC4D0' }}>
              {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
            </Button>
            {terminal && (
              <Button onClick={downloadTerminalLogs} sx={{ color: '#CAC4D0' }}>
                Download Logs
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Matcher Dialog */}
      {inputRequest && <InputDialog key={inputRequest.callback_id} request={inputRequest}
        onResolve={resolveInput} onStop={handleStop} stopping={isStopping} />}
      <MatcherDialog state={matcherState} sources={reorderSources} onReorder={setReorderSources}
        onCancel={handleMatcherCancel} onConfirm={handleMatcherConfirm} onStop={handleStop} stopping={isStopping} />
      <Dialog open={Boolean(notice)}
        onClose={() => setNotice(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{notice?.severity === 'success' ? 'Task completed' : notice?.severity === 'warning' ? 'Task completed with warnings' : notice?.severity === 'info' ? 'Task stopped' : 'Task failed'}</DialogTitle>
        <DialogContent><Alert severity={notice?.severity || 'info'}>{notice?.message}</Alert></DialogContent>
        <DialogActions><Button variant="contained" onClick={() => setNotice(null)}>OK</Button></DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
