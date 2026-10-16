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
import ContentCopy from '@mui/icons-material/ContentCopy';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import { motion, AnimatePresence } from 'framer-motion';
import Terminal from './components/Terminal';
import InputDialog from './components/InputDialog';
import MatcherDialog from './components/MatcherDialog';
import Sidebar from './components/Sidebar';
import PathInput from './components/PathInput';
import darkTheme from './theme';
import modules from './modules';
import { desktopBridge } from './bridge';

const DEFAULT_SETTINGS = {
  max_offset: 1,
  enable_max_offset: false,
  auto_audio: true,
  auto_subs: true,
  notify_on_finish: true,
  sound_on_finish: true,
};

function loadInitialSettings() {
  try {
    const raw = localStorage.getItem('syncforge_settings');
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_SETTINGS;
}

function loadInitialModule() {
  try {
    const savedId = localStorage.getItem('syncforge_selected_mod');
    if (savedId) {
      const found = modules.find((m) => m.id === savedId);
      if (found) return found;
    }
  } catch {
    // ignore storage errors
  }
  return modules[0];
}

function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function playCompletionSound(status) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (status === 'ok' || status === 'warning') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.11); // E5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (status === 'error') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.31);
    }
  } catch {
    // ignore audio synthesis failures in headless environments
  }
}

export default function App() {
  const [selectedMod, setSelectedMod] = useState(loadInitialModule);
  const [terminal, setTerminal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [inputRequest, setInputRequest] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [notice, setNotice] = useState(null);
  const [hasRun, setHasRun] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progress, setProgress] = useState({
    active: false,
    currentFile: '',
    fileIndex: 0,
    totalFiles: 0,
    filePercent: 0,
  });
  const runInFlight = useRef(false);
  const taskStartRef = useRef(null);
  const hoveredFieldRef = useRef(null);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const [paths, setPaths] = useState({
    video: '',
    sub: '',
    output: '',
  });

  const [settings, setSettings] = useState(loadInitialSettings);

  useEffect(() => {
    try {
      localStorage.setItem('syncforge_settings', JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('syncforge_selected_mod', selectedMod.id);
    } catch {
      // ignore storage errors
    }
  }, [selectedMod]);

  useEffect(() => {
    if (!isRunning) {
      taskStartRef.current = null;
      return;
    }
    taskStartRef.current = Date.now();
    const interval = setInterval(() => {
      if (taskStartRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - taskStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.metaKey && e.altKey && ['I', 'i', 'J', 'j'].includes(e.key))
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleDragEnter = (e) => {
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.length > 0) {
        dragCounterRef.current += 1;
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = () => {
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsWindowDragging(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
    };

    const handleDrop = () => {
      dragCounterRef.current = 0;
      setIsWindowDragging(false);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

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
      const pMatch = text.match(/Progress:\s*(\d+)%/i) || text.match(/(\d+)%\|/);
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

  const assignDroppedPaths = (droppedList) => {
    if (!droppedList || !droppedList.length || runInFlight.current) return;
    const hovered = hoveredFieldRef.current;
    if (hovered && selectedMod.needs.includes(hovered)) {
      setPaths((prev) => ({ ...prev, [hovered]: droppedList[0] }));
      return;
    }

    setPaths((prev) => {
      const next = { ...prev };
      for (const item of droppedList) {
        const ext = item.includes('.')
          ? item.slice(item.lastIndexOf('.')).toLowerCase()
          : '';
        const isSub = ['.srt', '.ass', '.ssa', '.sub', '.vtt'].includes(ext);
        const isVideo = ['.mkv', '.mp4', '.avi', '.mov'].includes(ext);

        if (isSub && selectedMod.needs.includes('sub')) {
          next.sub = item;
        } else if (isVideo) {
          if (
            !next.video ||
            !selectedMod.needs.includes('sub') ||
            selectedMod.id === 'sync_subs'
          ) {
            next.video = item;
          } else if (!next.sub) {
            next.sub = item;
          } else {
            next.video = item;
          }
        } else {
          // Folder or unknown extension
          if (!next.video) {
            next.video = item;
          } else if (selectedMod.needs.includes('sub') && !next.sub) {
            next.sub = item;
          } else if (selectedMod.needs.includes('output')) {
            next.output = item;
          }
        }
      }
      return next;
    });
  };

  const assignDroppedPathsRef = useRef(null);
  useEffect(() => {
    assignDroppedPathsRef.current = assignDroppedPaths;
  });

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

    let unlistenDrop = null;
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      import('@tauri-apps/api/webviewWindow')
        .then(({ getCurrentWebviewWindow }) => {
          const win = getCurrentWebviewWindow();
          return win.onDragDropEvent((event) => {
            if (event.payload.type === 'enter' || event.payload.type === 'over') {
              setIsWindowDragging(true);
            } else if (event.payload.type === 'leave') {
              setIsWindowDragging(false);
            } else if (event.payload.type === 'drop') {
              setIsWindowDragging(false);
              if (event.payload.paths?.length) {
                assignDroppedPathsRef.current(event.payload.paths);
              }
            }
          });
        })
        .then((unlisten) => {
          unlistenDrop = unlisten;
        })
        .catch(() => {});
    }

    return () => {
      delete window.frontend_api.append_terminal;
      delete window.frontend_api.ask_input;
      delete window.frontend_api.ask_matcher;
      delete window.frontend_api.cancel_requests;
      delete window.frontend_api.update_progress;
      if (typeof unlistenDrop === 'function') unlistenDrop();
    };
  }, []);

  const handleMatcherConfirm = (excludedTargets = []) => {
    const excludedSet = new Set(Array.isArray(excludedTargets) ? excludedTargets : []);
    const limit = Math.min(matcherState.targets.length, reorderSources.length);
    const pairs = [];
    for (let i = 0; i < limit; i++) {
      if (!excludedSet.has(i)) {
        pairs.push([matcherState.targets[i], reorderSources[i].path]);
      }
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
    setElapsedSeconds(0);
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
        if (settings.sound_on_finish ?? true) {
          playCompletionSound(result?.status);
        }
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
      if (settings.sound_on_finish ?? true) {
        playCompletionSound('error');
      }
      setNotice({ severity: 'error', message });
    } finally {
      runInFlight.current = false;
      setIsRunning(false);
      setIsStopping(false);
      setElapsedSeconds(0);
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

  const copyTerminalLogs = async () => {
    try {
      await navigator.clipboard.writeText(terminal);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
      // ignore clipboard permission errors
    }
  };

  const handleShowInFolder = async (targetPath) => {
    if (!targetPath || !desktopBridge.isConnected()) return;
    try {
      await desktopBridge.showInFolder(targetPath);
    } catch (error) {
      setNotice({
        severity: 'error',
        message: error.message || String(error),
      });
    }
  };

  const handlePickPath = async (key, kind, mediaType) => {
    if (desktopBridge.isConnected()) {
      try {
        const defaultHint =
          paths[key] || paths.video || paths.sub || paths.output || '';
        const path =
          kind === 'file'
            ? await desktopBridge.pickFile(mediaType, defaultHint)
            : await desktopBridge.pickFolder(defaultHint);
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

  const etaSeconds =
    overallPercent > 2 && overallPercent < 100 && elapsedSeconds > 0
      ? Math.max(1, Math.round((elapsedSeconds * (100 - overallPercent)) / overallPercent))
      : null;

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = e.dataTransfer?.files;
          if (files && files.length > 0) {
            const list = Array.from(files)
              .map((f) => f.path || f.name)
              .filter(Boolean);
            assignDroppedPaths(list);
          }
        }}
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
                    isWindowDragging={isWindowDragging}
                    onChange={(video) => setPaths((p) => ({ ...p, video }))}
                    onPick={(kind, type) => handlePickPath('video', kind, type)}
                    onShowInFolder={handleShowInFolder}
                    onDragHoverChange={(hovered) => {
                      hoveredFieldRef.current = hovered ? 'video' : null;
                    }}
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
                    isWindowDragging={isWindowDragging}
                    onChange={(sub) => setPaths((p) => ({ ...p, sub }))}
                    onPick={(kind, type) => handlePickPath('sub', kind, type)}
                    onShowInFolder={handleShowInFolder}
                    onDragHoverChange={(hovered) => {
                      hoveredFieldRef.current = hovered ? 'sub' : null;
                    }}
                  />
                )}
                {selectedMod.needs.includes('output') && (
                  <PathInput
                    label={selectedMod.labels[2]}
                    value={paths.output}
                    disabled={isRunning}
                    placeholder="If not selected, output folder remains the source folder"
                    isWindowDragging={isWindowDragging}
                    onChange={(output) => setPaths((p) => ({ ...p, output }))}
                    onPick={(kind) => handlePickPath('output', kind)}
                    onShowInFolder={handleShowInFolder}
                    onDragHoverChange={(hovered) => {
                      hoveredFieldRef.current = hovered ? 'output' : null;
                    }}
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
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                              variant="caption"
                              data-testid="eta-label"
                              sx={{
                                fontFamily: 'monospace',
                                color: 'text.secondary',
                                fontSize: '0.75rem',
                              }}
                            >
                              {`Elapsed: ${formatDuration(elapsedSeconds)}${
                                etaSeconds !== null
                                  ? ` • ETA: ~${formatDuration(etaSeconds)}`
                                  : ''
                              }`}
                            </Typography>
                          </Box>
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
              <>
                <Button
                  size="small"
                  startIcon={<ContentCopy fontSize="small" />}
                  onClick={copyTerminalLogs}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                  {copiedLogs ? 'Copied!' : 'Copy Logs'}
                </Button>
                <Button
                  size="small"
                  startIcon={<Download fontSize="small" />}
                  onClick={downloadTerminalLogs}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                  Download Logs
                </Button>
              </>
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
        key={matcherState.open ? 'open' : 'closed'}
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
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          {(notice?.severity === 'success' || notice?.severity === 'warning') &&
            (paths.output || paths.video) && (
              <Button
                variant="outlined"
                startIcon={<FolderOpenOutlined fontSize="small" />}
                onClick={() => handleShowInFolder(paths.output || paths.video)}
              >
                Show in Folder
              </Button>
            )}
          <Button variant="contained" onClick={() => setNotice(null)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
