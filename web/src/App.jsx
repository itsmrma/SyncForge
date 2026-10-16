import { useState, useEffect, useRef } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  LinearProgress,
} from '@mui/material';
import Stop from '@mui/icons-material/Stop';
import PlayArrow from '@mui/icons-material/PlayArrow';
import TerminalIcon from '@mui/icons-material/Terminal';
import Download from '@mui/icons-material/Download';
import { motion, AnimatePresence } from 'framer-motion';
import Terminal from './components/Terminal';
import InputDialog from './components/InputDialog';
import MatcherDialog from './components/MatcherDialog';
import Sidebar from './components/Sidebar';
import PathInput from './components/PathInput';
import darkTheme from './theme';
import modules from './modules';
import { desktopBridge } from './bridge';

export default function App() {
  const [selectedMod, setSelectedMod] = useState(modules[0]);
  const [terminal, setTerminal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [inputRequest, setInputRequest] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [notice, setNotice] = useState(null);
  const [hasRun, setHasRun] = useState(false);
  const [progress, setProgress] = useState({
    active: false,
    currentFile: '',
    fileIndex: 0,
    totalFiles: 0,
    filePercent: 0,
  });
  const runInFlight = useRef(false);

  const [paths, setPaths] = useState({
    video: '',
    sub: '',
    output: '',
  });

  const [settings, setSettings] = useState({
    max_offset: 1,
    enable_max_offset: false,
    auto_audio: true,
    auto_subs: true,
    notify_on_finish: true,
  });

  const [matcherState, setMatcherState] = useState({
    open: false,
    targets: [],
    sources: [],
    resolve: null,
  });
  const [reorderSources, setReorderSources] = useState([]);

  const followTerminalRef = useRef(true);

  const append_terminal = (text) => {
    setTerminal((prev) => {
      const next = prev + text;
      const pMatch = text.match(/Progress:\s*(\d+)%/i);
      if (pMatch) {
        const pct = parseInt(pMatch[1], 10);
        setProgress((p) => ({ ...p, filePercent: pct }));
      }
      if (next.length > 50000 && followTerminalRef.current) {
        return next.slice(next.length - 50000);
      }
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
      await desktopBridge.resolveMatcher(callback_id, res, sourceOrder);
    };

    setMatcherState({
      open: true,
      targets,
      sources: uniqueSources,
      resolve: resolveAndNotify,
    });
  };

  useEffect(() => {
    window.frontend_api = window.frontend_api || {};
    window.frontend_api.append_terminal = append_terminal;
    window.frontend_api.ask_input = ask_input;
    window.frontend_api.ask_matcher = ask_matcher;
    window.frontend_api.cancel_requests = cancel_requests;
    window.frontend_api.update_progress = (data) => {
      setProgress((prev) => ({
        ...prev,
        active: true,
        currentFile: data.currentFile ?? prev.currentFile,
        fileIndex: data.fileIndex ?? prev.fileIndex,
        totalFiles: data.totalFiles ?? prev.totalFiles,
        filePercent: data.filePercent ?? prev.filePercent,
      }));
    };
    return () => {
      delete window.frontend_api.append_terminal;
      delete window.frontend_api.ask_input;
      delete window.frontend_api.ask_matcher;
      delete window.frontend_api.cancel_requests;
      delete window.frontend_api.update_progress;
    };
  }, []);

  const handleMatcherConfirm = () => {
    const limit = Math.min(matcherState.targets.length, reorderSources.length);
    const pairs = [];
    for (let i = 0; i < limit; i++) {
      pairs.push([matcherState.targets[i], reorderSources[i].path]);
    }
    matcherState.resolve(
      pairs,
      reorderSources.map((source) => source.path)
    );
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
    setProgress({
      active: true,
      currentFile: 'Initializing...',
      fileIndex: 0,
      totalFiles: 0,
      filePercent: 0,
    });
    try {
      if (desktopBridge.isConnected()) {
        const result = await desktopBridge.runModule(
          selectedMod.id,
          settings,
          paths,
          repeat
        );
        const severity =
          result?.status === 'ok'
            ? 'success'
            : result?.status === 'warning'
              ? 'warning'
              : result?.status === 'cancelled'
                ? 'info'
                : 'error';
        setNotice({
          severity,
          message:
            result?.message ||
            'The task returned no result. Check the terminal.',
        });
        if (result && result.status !== 'busy') setHasRun(true);
      } else {
        append_terminal('Desktop API is not connected. Running in browser preview?\n');
        setNotice({
          severity: 'error',
          message: 'The desktop backend is not connected.',
        });
      }
    } catch (error) {
      const message = error.message || String(error);
      append_terminal(`\n[ERROR] ${message}\n`);
      setNotice({ severity: 'error', message });
    } finally {
      runInFlight.current = false;
      setIsRunning(false);
      setIsStopping(false);
      setProgress({
        active: false,
        currentFile: '',
        fileIndex: 0,
        totalFiles: 0,
        filePercent: 0,
      });
      cancel_requests();
    }
  };

  const handleStop = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      const result = await desktopBridge.stopTask();
      if (result?.status === 'idle') setIsStopping(false);
    } catch (error) {
      setIsStopping(false);
      setNotice({ severity: 'error', message: error.message || String(error) });
    }
  };

  const resolveInput = async (value) => {
    await desktopBridge.resolveInput(inputRequest.callback_id, value);
    setInputRequest((current) =>
      current?.callback_id === inputRequest.callback_id ? null : current
    );
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
    if (desktopBridge.isConnected()) {
      try {
        const path =
          kind === 'file'
            ? await desktopBridge.pickFile(mediaType)
            : await desktopBridge.pickFolder();
        if (path) setPaths((prev) => ({ ...prev, [key]: path }));
      } catch (error) {
        setNotice({
          severity: 'error',
          message: error.message || String(error),
        });
      }
    }
  };

  const ActiveIcon = selectedMod.icon;

  const overallPercent =
    progress.totalFiles > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((Math.max(0, progress.fileIndex - 1) +
              Math.min(100, Math.max(0, progress.filePercent)) / 100) /
              progress.totalFiles) *
              100
          )
        )
      : 0;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          bgcolor: 'background.default',
          backgroundImage:
            'radial-gradient(circle at 85% 10%, rgba(99, 102, 241, 0.10) 0%, transparent 45%), radial-gradient(circle at 20% 90%, rgba(56, 189, 248, 0.06) 0%, transparent 40%)',
        }}
      >
        <Sidebar
          selectedMod={selectedMod}
          onSelect={setSelectedMod}
          running={isRunning}
          hasRun={hasRun}
          onRepeat={() => handleRun(true)}
          settings={settings}
          onSettingsChange={setSettings}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            px: { xs: 3, md: 4 },
            py: 3,
            overflowY: 'auto',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMod.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {/* Modern Workspace Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2.5,
                  pb: 2,
                  borderBottom: '1px solid rgba(148, 163, 184, 0.10)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(56, 189, 248, 0.12) 100%)',
                      border: '1px solid rgba(99, 102, 241, 0.35)',
                      color: '#818CF8',
                    }}
                  >
                    <ActiveIcon />
                  </Box>
                  <Box>
                    <Typography variant="h3" sx={{ lineHeight: 1.15 }}>
                      {selectedMod.title}
                    </Typography>
                  </Box>
                </Box>

                <Chip
                  size="small"
                  label={
                    isStopping
                      ? 'Stopping'
                      : isRunning
                        ? 'Processing'
                        : 'Ready'
                  }
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    bgcolor: isRunning
                      ? 'rgba(99, 102, 241, 0.16)'
                      : 'rgba(16, 185, 129, 0.12)',
                    color: isRunning ? '#818CF8' : '#34D399',
                    border: '1px solid',
                    borderColor: isRunning
                      ? 'rgba(99, 102, 241, 0.35)'
                      : 'rgba(16, 185, 129, 0.3)',
                  }}
                />
              </Box>

              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 3, maxWidth: 680, lineHeight: 1.6, fontSize: '0.94rem' }}
              >
                {selectedMod.desc}
              </Typography>

              {/* Path Configuration Card */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  mb: 3,
                  maxWidth: 680,
                  p: 2.5,
                  borderRadius: 2.5,
                  bgcolor: 'rgba(15, 20, 31, 0.72)',
                  border: '1px solid rgba(148, 163, 184, 0.12)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {selectedMod.needs.includes('video') && (
                  <PathInput
                    label={selectedMod.labels[0]}
                    value={paths.video}
                    mediaType="video"
                    disabled={isRunning}
                    onChange={(video) => setPaths((p) => ({ ...p, video }))}
                    onPick={(kind, type) => handlePickPath('video', kind, type)}
                  />
                )}
                {selectedMod.needs.includes('sub') && (
                  <PathInput
                    label={selectedMod.labels[1]}
                    value={paths.sub}
                    disabled={isRunning}
                    mediaType={
                      selectedMod.id === 'sync_subs' ? 'subtitles' : 'video'
                    }
                    onChange={(sub) => setPaths((p) => ({ ...p, sub }))}
                    onPick={(kind, type) => handlePickPath('sub', kind, type)}
                  />
                )}
                {selectedMod.needs.includes('output') && (
                  <PathInput
                    label={selectedMod.labels[2]}
                    value={paths.output}
                    disabled={isRunning}
                    placeholder="Leave empty to use the target's folder"
                    onChange={(output) => setPaths((p) => ({ ...p, output }))}
                    onPick={(kind) => handlePickPath('output', kind)}
                  />
                )}
              </Box>

              {/* Primary Action Controls */}
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<PlayArrow />}
                  onClick={() => handleRun(false)}
                  disabled={isRunning}
                  sx={{
                    px: 3.5,
                    py: 1.2,
                    fontWeight: 700,
                    fontSize: '0.92rem',
                  }}
                >
                  {isRunning ? 'Running...' : 'Launch Module'}
                </Button>
                {isRunning && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="large"
                    startIcon={<Stop />}
                    onClick={handleStop}
                    disabled={isStopping}
                    sx={{ px: 2.5, py: 1.2 }}
                  >
                    {isStopping ? 'Stopping...' : 'Stop task'}
                  </Button>
                )}
              </Box>

              {/* Progress Section: Overall and Current File */}
              <AnimatePresence>
                {isRunning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -6 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Box
                      data-testid="progress-container"
                      sx={{
                        mt: 2.5,
                        maxWidth: 680,
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'rgba(15, 20, 31, 0.85)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        backdropFilter: 'blur(10px)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                      }}
                    >
                      {/* Overall Progress */}
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 0.75,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: 'text.secondary',
                              fontSize: '0.82rem',
                            }}
                          >
                            Overall Progress
                          </Typography>
                          <Typography
                            variant="body2"
                            data-testid="overall-progress-label"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#818CF8',
                              fontSize: '0.82rem',
                            }}
                          >
                            {progress.totalFiles > 0
                              ? `File ${progress.fileIndex} of ${progress.totalFiles} (${Math.round(overallPercent)}%)`
                              : isStopping
                                ? 'Stopping...'
                                : 'Processing...'}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant={progress.totalFiles > 0 ? 'determinate' : 'indeterminate'}
                          value={overallPercent}
                          aria-label="Overall Progress"
                          sx={{
                            height: 7,
                            borderRadius: 4,
                            bgcolor: 'rgba(255, 255, 255, 0.08)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                              background: 'linear-gradient(90deg, #6366F1 0%, #38BDF8 100%)',
                            },
                          }}
                        />
                      </Box>

                      {/* Current File Progress */}
                      <Box>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 0.75,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, mr: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: 'text.secondary',
                                fontSize: '0.82rem',
                                flexShrink: 0,
                              }}
                            >
                              Current File:
                            </Typography>
                            <Typography
                              variant="body2"
                              data-testid="current-file-label"
                              noWrap
                              sx={{
                                fontFamily: 'monospace',
                                color: 'text.primary',
                                fontSize: '0.82rem',
                                maxWidth: { xs: 260, sm: 360, md: 460 },
                              }}
                            >
                              {progress.currentFile || 'Initializing...'}
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            data-testid="file-progress-label"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#38BDF8',
                              fontSize: '0.82rem',
                            }}
                          >
                            {`${Math.round(progress.filePercent)}%`}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, Math.max(0, progress.filePercent))}
                          aria-label="Current File Progress"
                          sx={{
                            height: 6,
                            borderRadius: 4,
                            bgcolor: 'rgba(255, 255, 255, 0.08)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                              background: 'linear-gradient(90deg, #38BDF8 0%, #34D399 100%)',
                            },
                          }}
                        />
                      </Box>
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>

          {/* Developer Console Drawer */}
          <Box
            sx={{
              height: showTerminal ? 230 : 0,
              transition: 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
              mt: 2,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Terminal
              text={terminal}
              visible={showTerminal}
              onFollowChange={(following) => {
                followTerminalRef.current = following;
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              mt: 1,
              pt: 1,
              borderTop: '1px solid rgba(148, 163, 184, 0.08)',
              alignSelf: 'stretch',
              alignItems: 'center',
            }}
          >
            <Button
              size="small"
              startIcon={<TerminalIcon fontSize="small" />}
              onClick={() => setShowTerminal(!showTerminal)}
              sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
            >
              {showTerminal ? 'Hide Terminal' : 'Show Terminal'}
            </Button>
            {terminal && (
              <Button
                size="small"
                startIcon={<Download fontSize="small" />}
                onClick={downloadTerminalLogs}
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
              >
                Download Logs
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {inputRequest && (
        <InputDialog
          key={inputRequest.callback_id}
          request={inputRequest}
          onResolve={resolveInput}
          onStop={handleStop}
          stopping={isStopping}
        />
      )}
      <MatcherDialog
        state={matcherState}
        sources={reorderSources}
        onReorder={setReorderSources}
        onCancel={handleMatcherCancel}
        onConfirm={handleMatcherConfirm}
        onStop={handleStop}
        stopping={isStopping}
      />
      <Dialog
        open={Boolean(notice)}
        onClose={() => setNotice(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {notice?.severity === 'success'
            ? 'Task completed'
            : notice?.severity === 'warning'
              ? 'Task completed with warnings'
              : notice?.severity === 'info'
                ? 'Task stopped'
                : 'Task failed'}
        </DialogTitle>
        <DialogContent>
          <Alert severity={notice?.severity || 'info'} sx={{ borderRadius: 2 }}>
            {notice?.message}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setNotice(null)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
