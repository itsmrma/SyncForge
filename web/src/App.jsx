import { useState, useEffect, useRef, useMemo } from 'react';
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
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import Stop from '@mui/icons-material/Stop';
import PlayArrow from '@mui/icons-material/PlayArrow';
import TerminalIcon from '@mui/icons-material/Terminal';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import MovieOutlined from '@mui/icons-material/MovieOutlined';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined';
import GraphicEq from '@mui/icons-material/GraphicEq';
import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined';
import CodeOutlined from '@mui/icons-material/CodeOutlined';
import { motion, AnimatePresence } from 'framer-motion';
import Terminal from './components/Terminal';
import InputDialog from './components/InputDialog';
import MatcherDialog from './components/MatcherDialog';
import SyncPreviewDialog from './components/SyncPreviewDialog';
import CliExportDialog from './components/CliExportDialog';
import Sidebar from './components/Sidebar';
import PathInput from './components/PathInput';
import { getAppTheme } from './theme';
import modules from './modules';
import { desktopBridge } from './bridge';
import {
  loadInitialShortcuts,
  matchesShortcut,
  formatShortcutDisplay,
} from './shortcuts';

const TOAST_DURATION_MS = 5000;

const DEFAULT_SETTINGS = {
  max_offset: 1,
  enable_max_offset: false,
  auto_audio: true,
  auto_subs: true,
  opus_mode: 'off',
  opus_bitrate: 128,
  opus_downmix: true,
  default_output_dir: '',
  notify_on_finish: true,
  sound_on_finish: true,
  theme_mode: 'dark',
  preview_mpv: false,
  opensubtitles_api_key: '',
  opensubtitles_token: '',
};

function parseSubTaskFromLog(text) {
  if (!text) return null;
  if (/Analyzing.*?structure|Probing:/i.test(text)) {
    return 'Analyzing file structures and dividing into groups...';
  }
  if (/\[ffmpeg\].*?(?:audio|waveform)|Extracting audio waveform/i.test(text)) {
    return 'Extracting audio waveform (FFmpeg)...';
  }
  if (/\[rustfft\]|Calculating waveform delay|Searching for sync/i.test(text)) {
    return 'Calculating FFT cross-correlation delay (RustFFT)...';
  }
  if (/\[ffsubsync\]|Synchronizing subtitles|Starting ffsubsync|Running ffsubsync/i.test(text)) {
    return 'Synchronizing subtitles to speech (FFsubsync)...';
  }
  if (/Extracting Sub ID/i.test(text)) {
    return 'Extracting subtitle stream (mkvextract)...';
  }
  if (/Extracting Audio ID/i.test(text)) {
    return 'Extracting audio stream (mkvextract)...';
  }
  if (/\[mkvextract\]|Extracting media stream/i.test(text)) {
    return 'Extracting media stream (mkvextract)...';
  }
  if (/Importing attachments|Importing fonts/i.test(text)) {
    return 'Importing subtitle fonts & attachments (mkvmerge)...';
  }
  if (/Opus conversion|Converting audio to Opus/i.test(text)) {
    return 'Encoding audio stream to Opus (libopus)...';
  }
  if (/Modifying in-place|mkvpropedit/i.test(text)) {
    return 'Applying track flags in-place (mkvpropedit)...';
  }
  if (/\[mkvmerge\]|Writing MKV file|^mkvmerge v\d|^The file .+ has been opened for writing\./im.test(text)) {
    return 'Muxing streams into Matroska container (mkvmerge)...';
  }
  if (/\[mpv\]/i.test(text)) {
    return 'Auditioning synchronization in mpv player...';
  }
  if (/Searching subtitles|OpenSubtitles/i.test(text)) {
    return 'Searching subtitles online (OpenSubtitles)...';
  }
  return null;
}

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

function loadInitialRecentPaths() {
  try {
    const raw = localStorage.getItem('syncforge_recent_paths');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).slice(0, 8);
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function buildQuickMediaSummary(videoPath, backendData) {
  const trimmed = (videoPath || '').trim();
  if (!trimmed) return null;
  const baseName = trimmed.split(/[\\/]/).filter(Boolean).pop() || trimmed;
  const extMatch = baseName.match(/\.([a-z0-9]{2,4})$/i);
  const ext = extMatch ? extMatch[1].toUpperCase() : '';
  const isKnownMedia = ['MKV', 'MP4', 'AVI', 'MOV'].includes(ext);

  const kind = backendData?.kind || (isKnownMedia ? 'file' : 'folder');
  const badge =
    kind === 'folder'
      ? 'Folder'
      : backendData?.container || ext || 'FILE';
  const name = backendData?.name || baseName;
  const tracks = Array.isArray(backendData?.tracks) ? backendData.tracks : [];
  const videoTrack = tracks.find((t) => t.type === 'video');
  const audioTracks = tracks.filter((t) => t.type === 'audio');
  const subTracks = tracks.filter((t) => t.type === 'subtitles');

  const audioSummary = audioTracks.length
    ? audioTracks
        .map((t) => (t.properties?.language || t.language || 'und').toUpperCase())
        .join(', ')
    : null;

  const subSummary = subTracks.length
    ? subTracks
        .map((t) => {
          const lang = (t.properties?.language || t.language || 'und').toUpperCase();
          if (t.properties?.forced_track ?? t.forced_track) return `${lang} [Forced]`;
          if (t.properties?.default_track ?? t.default_track) return `${lang} [Default]`;
          return lang;
        })
        .join(', ')
    : null;

  return {
    kind,
    badge,
    name,
    videoCodec: videoTrack?.codec || null,
    audioCount: audioTracks.length,
    audioSummary,
    audioTracks,
    subCount:
      kind === 'folder' ? backendData?.sub_count : subTracks.length,
    subSummary,
    subTracks,
    videoCount: kind === 'folder' ? backendData?.video_count : undefined,
    hasAttachments: Boolean(backendData?.has_attachments),
  };
}

function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function getParentFolder(filePath) {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const last = parts[parts.length - 1];
  if (last.includes('.')) {
    parts.pop();
    return parts.join('/') || '/';
  }
  return filePath;
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
  const [matcherState, setMatcherState] = useState({
    open: false,
    targets: [],
    sources: [],
    resolve: null,
  });
  const [reorderSources, setReorderSources] = useState([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalDocked, setTerminalDocked] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(230);
  const [isTerminalDragging, setIsTerminalDragging] = useState(false);
  const terminalDraggingRef = useRef(false);
  const terminalDragStartYRef = useRef(0);
  const terminalDragStartHeightRef = useRef(230);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [cliExportOpen, setCliExportOpen] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [notice, setNotice] = useState(null);
  const [toastRemainingMs, setToastRemainingMs] = useState(TOAST_DURATION_MS);
  const [isWindowFocused, setIsWindowFocused] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() && !document.hidden : true
  );
  const [isToastHovered, setIsToastHovered] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentSubTask, setCurrentSubTask] = useState('');
  const [progress, setProgress] = useState({
    active: false,
    currentFile: '',
    fileIndex: 0,
    totalFiles: 0,
    filePercent: 0,
  });
  const runInFlight = useRef(false);
  const taskStartRef = useRef(null);
  const processingStartRef = useRef(null);
  const progressHistoryRef = useRef([]);
  const smoothedEtaRef = useRef(null);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const currentOverallPercentRef = useRef(0);
  const hoveredFieldRef = useRef(null);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const logBufferRef = useRef('');
  const logRafRef = useRef(null);

  const [paths, setPaths] = useState({
    video: '',
    sub: '',
    output: '',
  });
  const [fieldErrors, setFieldErrors] = useState({
    video: '',
    sub: '',
  });
  const [recentPaths, setRecentPaths] = useState(loadInitialRecentPaths);
  const [mediaBackendData, setMediaBackendData] = useState(null);

  const [settings, setSettings] = useState(loadInitialSettings);
  const [shortcuts, setShortcuts] = useState(loadInitialShortcuts);
  const prefersDarkQuery = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const isLgUp = useMediaQuery('(min-width:1200px)', { noSsr: true });

  const resolvedThemeMode = useMemo(() => {
    const mode = settings.theme_mode || 'dark';
    if (mode === 'system') {
      return prefersDarkQuery ? 'dark' : 'light';
    }
    return mode === 'light' ? 'light' : 'dark';
  }, [settings.theme_mode, prefersDarkQuery]);

  const activeTheme = useMemo(() => getAppTheme(resolvedThemeMode), [resolvedThemeMode]);

  const addRecentPath = (rawPath) => {
    const trimmed = (rawPath || '').trim();
    if (!trimmed) return;
    setRecentPaths((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 8);
      try {
        localStorage.setItem('syncforge_recent_paths', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const clearRecentPaths = () => {
    setRecentPaths([]);
    try {
      localStorage.removeItem('syncforge_recent_paths');
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (desktopBridge.isConnected()) {
      desktopBridge
        .loadSettings()
        .then((loaded) => {
          if (loaded && typeof loaded === 'object' && Object.keys(loaded).length > 0) {
            setSettings((prev) => ({ ...prev, ...loaded }));
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('syncforge_settings', JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
    if (desktopBridge.isConnected()) {
      desktopBridge.saveSettings(settings).catch(() => {});
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('syncforge_shortcuts', JSON.stringify(shortcuts));
    } catch {
      // ignore storage errors
    }
  }, [shortcuts]);

  useEffect(() => {
    try {
      localStorage.setItem('syncforge_selected_mod', selectedMod.id);
    } catch {
      // ignore storage errors
    }
  }, [selectedMod]);

  useEffect(() => {
    let cancelled = false;
    const videoPath = (paths.video || '').trim();
    if (!videoPath || !desktopBridge.isConnected()) {
      return;
    }
    desktopBridge
      .inspectMedia(videoPath)
      .then((res) => {
        if (!cancelled) {
          setMediaBackendData(res ? { ...res, _forPath: videoPath } : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMediaBackendData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [paths.video]);

  useEffect(() => {
    const onFocus = () => setIsWindowFocused(true);
    const onBlur = () => setIsWindowFocused(false);
    const onVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
      } else if (document.hasFocus()) {
        setIsWindowFocused(true);
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (notice?.severity !== 'success' || !isWindowFocused || isToastHovered) {
      return;
    }
    let lastTime = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;
      setToastRemainingMs((prev) => {
        const next = prev - delta;
        if (next <= 0) {
          setNotice(null);
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [notice, isWindowFocused, isToastHovered]);

  useEffect(() => {
    const move = (e) => {
      if (!terminalDraggingRef.current) return;
      const dy = terminalDragStartYRef.current - e.clientY;
      const maxAllowed = typeof window !== 'undefined'
        ? Math.max(240, Math.min(520, Math.floor(window.innerHeight * 0.65)))
        : 520;
      const nextHeight = Math.min(
        maxAllowed,
        Math.max(140, terminalDragStartHeightRef.current + dy)
      );
      setTerminalHeight(nextHeight);
    };
    const stop = () => {
      if (!terminalDraggingRef.current) return;
      terminalDraggingRef.current = false;
      setIsTerminalDragging(false);
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

  const updateEta = (overall) => {
    currentOverallPercentRef.current = overall;
    if (!processingStartRef.current || overall < 2 || overall >= 99) {
      smoothedEtaRef.current = null;
      setEtaSeconds(null);
      return;
    }
    const activeSec = (Date.now() - processingStartRef.current) / 1000;
    if (activeSec < 2.0) {
      smoothedEtaRef.current = null;
      setEtaSeconds(null);
      return;
    }
    const overallRate = overall / activeSec;
    let rate = overallRate;
    const hist = progressHistoryRef.current;
    if (hist.length >= 2) {
      const oldest = hist[0];
      const newest = hist[hist.length - 1];
      const dt = (newest.time - oldest.time) / 1000;
      const dp = newest.percent - oldest.percent;
      if (dt >= 3.0 && dp > 0) {
        const windowRate = dp / dt;
        rate = 0.60 * overallRate + 0.40 * windowRate;
      }
    }
    if (rate > 0) {
      const rawRemaining = (100 - overall) / rate;
      if (smoothedEtaRef.current === null) {
        smoothedEtaRef.current = rawRemaining;
      } else {
        const alpha = 0.16;
        const maxJump = Math.max(4, smoothedEtaRef.current * 0.20);
        const clampedTarget = Math.max(
          smoothedEtaRef.current - maxJump,
          Math.min(smoothedEtaRef.current + maxJump, rawRemaining)
        );
        smoothedEtaRef.current = alpha * clampedTarget + (1 - alpha) * smoothedEtaRef.current;
      }
      setEtaSeconds(Math.max(1, Math.round(smoothedEtaRef.current)));
    } else {
      setEtaSeconds(null);
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    taskStartRef.current = Date.now();
    const interval = setInterval(() => {
      if (taskStartRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - taskStartRef.current) / 1000));
      }
      if (inputRequest || matcherState.open) {
        processingStartRef.current = null;
        progressHistoryRef.current = [];
        smoothedEtaRef.current = null;
        setEtaSeconds(null);
      } else if (processingStartRef.current) {
        if (smoothedEtaRef.current !== null && smoothedEtaRef.current > 1) {
          smoothedEtaRef.current -= 1;
          setEtaSeconds(Math.max(1, Math.round(smoothedEtaRef.current)));
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, inputRequest, matcherState.open]);

  const handleRunRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.metaKey && e.altKey && ['I', 'i', 'J', 'j'].includes(e.key))
      ) {
        e.preventDefault();
        return;
      }

      if (
        document.querySelector('[data-testid="shortcut-capture-dialog"]') ||
        document.querySelector('[data-testid="shortcut-conflict-dialog"]')
      ) {
        return;
      }

      const tagName = document.activeElement?.tagName;
      const isInputFocused =
        tagName === 'INPUT' || tagName === 'TEXTAREA' || document.activeElement?.isContentEditable;
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      if (matchesShortcut(e, shortcuts.open_settings)) {
        if (!isInputFocused || hasModifier) {
          e.preventDefault();
          setSettingsTab('general');
          setSettingsOpen((prev) => !prev);
          return;
        }
      }

      if (settingsOpen) {
        return;
      }

      if (matchesShortcut(e, shortcuts.launch_module)) {
        if (!runInFlight.current && !inputRequest && !matcherState.open) {
          e.preventDefault();
          handleRunRef.current?.(false);
        }
        return;
      }

      if (matchesShortcut(e, shortcuts.repeat_last)) {
        if (!runInFlight.current && hasRun && !inputRequest && !matcherState.open) {
          e.preventDefault();
          handleRunRef.current?.(true);
        }
        return;
      }

      if (matchesShortcut(e, shortcuts.toggle_terminal)) {
        if (!isInputFocused || hasModifier) {
          e.preventDefault();
          setShowTerminal((prev) => !prev);
          return;
        }
      }

      for (let i = 0; i < modules.length; i++) {
        if (matchesShortcut(e, shortcuts[`module_${i + 1}`])) {
          if ((!isInputFocused || hasModifier) && !runInFlight.current && !inputRequest && !matcherState.open) {
            e.preventDefault();
            setSelectedMod(modules[i]);
          }
          return;
        }
      }

      if (
        matchesShortcut(e, shortcuts.close_dialog) &&
        notice &&
        !inputRequest &&
        !matcherState.open
      ) {
        setNotice(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasRun, inputRequest, matcherState.open, settingsOpen, notice, shortcuts]);

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

  const followTerminalRef = useRef(true);

  const flushTerminalBuffer = () => {
    logRafRef.current = null;
    const chunk = logBufferRef.current;
    if (!chunk) return;
    logBufferRef.current = '';
    setTerminal((prev) => {
      const next = prev + chunk;
      if (next.length > 50000 && followTerminalRef.current) {
        return next.slice(next.length - 50000);
      }
      return next;
    });
  };

  const append_terminal = (text) => {
    if (!text) return;

    const pMatch = text.match(/Progress:\s*(\d+)%/i) || text.match(/(\d+)%\|/);
    if (pMatch) {
      const pct = parseInt(pMatch[1], 10);
      if (!processingStartRef.current && pct > 0) {
        processingStartRef.current = Date.now();
      }
      setProgress((p) => ({ ...p, filePercent: pct }));
    }

    const detectedSubTask = parseSubTaskFromLog(text);
    if (detectedSubTask) {
      setCurrentSubTask(detectedSubTask);
    }

    const probeMatch = text.match(/Probing:\s*([^\r\n]+)/i);
    if (probeMatch) {
      setProgress((p) => ({ ...p, currentFile: probeMatch[1].trim() }));
    }

    logBufferRef.current += text;
    if (!logRafRef.current) {
      logRafRef.current = requestAnimationFrame(flushTerminalBuffer);
    }
  };

  const ask_input = (request, callback_id) => {
    setInputRequest({ ...request, callback_id });
  };

  const ask_sync_preview = (firstArg, secondArg) => {
    const isFirstCallbackId =
      typeof firstArg === 'string' && secondArg && typeof secondArg === 'object';
    const previewMeta = isFirstCallbackId ? secondArg : firstArg;
    const callback_id = isFirstCallbackId ? firstArg : secondArg;
    setInputRequest({
      kind: 'sync_preview',
      prompt: `Verify sync for ${previewMeta?.filename || previewMeta?.file_name || 'media'}`,
      context:
        typeof previewMeta === 'string'
          ? previewMeta
          : JSON.stringify(previewMeta || {}),
      callback_id,
    });
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
    for (const item of droppedList) {
      addRecentPath(item);
    }
    const hovered = hoveredFieldRef.current;
    if (hovered && selectedMod.needs.includes(hovered)) {
      setPaths((prev) => ({ ...prev, [hovered]: droppedList[0] }));
      if (hovered === 'video' || hovered === 'sub') {
        setFieldErrors((prev) => ({ ...prev, [hovered]: '' }));
      }
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
      setFieldErrors({
        video: next.video ? '' : fieldErrors.video,
        sub: next.sub ? '' : fieldErrors.sub,
      });
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
    window.frontend_api.ask_sync_preview = ask_sync_preview;
    window.frontend_api.ask_matcher = ask_matcher;
    window.frontend_api.cancel_requests = cancel_requests;
    window.frontend_api.update_progress = (data) => {
      const filePct = data.filePercent ?? 0;
      const fileIdx = data.fileIndex ?? 1;
      const totalF = data.totalFiles ?? 1;
      if (!processingStartRef.current && (filePct > 0 || fileIdx > 0)) {
        processingStartRef.current = Date.now();
      }
      const curOverall =
        totalF > 0
          ? Math.min(100, Math.max(0, ((Math.max(0, fileIdx - 1) + filePct / 100) / totalF) * 100))
          : 0;
      const now = Date.now();
      const hist = progressHistoryRef.current;
      hist.push({ time: now, percent: curOverall });
      while (hist.length > 20 || (hist.length > 2 && now - hist[0].time > 15000)) {
        hist.shift();
      }
      updateEta(curOverall);

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
      if (logRafRef.current) {
        cancelAnimationFrame(logRafRef.current);
      }
      delete window.frontend_api.append_terminal;
      delete window.frontend_api.ask_input;
      delete window.frontend_api.ask_sync_preview;
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
      const src = reorderSources[i];
      if (!excludedSet.has(i) && src && !src.isGap && src.path) {
        pairs.push([matcherState.targets[i], src.path]);
      }
    }
    matcherState.resolve(
      pairs,
      reorderSources.filter((s) => s && !s.isGap && s.path).map((source) => source.path)
    );
    setMatcherState({ open: false, targets: [], sources: [], resolve: null });
  };

  const handleMatcherCancel = () => {
    matcherState.resolve([]);
    setMatcherState({ open: false, targets: [], sources: [], resolve: null });
  };

  const handleRun = async (repeat = false) => {
    if (runInFlight.current) return;

    if (!repeat) {
      const nextErrors = { video: '', sub: '' };
      if (selectedMod.needs.includes('video') && !paths.video.trim()) {
        nextErrors.video = `${selectedMod.labels[0]} is required before launching.`;
      }
      if (selectedMod.needs.includes('sub') && !paths.sub.trim()) {
        nextErrors.sub = `${selectedMod.labels[1]} is required before launching.`;
      }
      if (nextErrors.video || nextErrors.sub) {
        setFieldErrors(nextErrors);
        const hasLegacyMock =
          typeof window !== 'undefined' &&
          Boolean(window.pywebview?.api?.run_module) &&
          !window.pywebview?.api?.enforce_preflight_validation;
        if (!hasLegacyMock) {
          return;
        }
      } else {
        setFieldErrors({ video: '', sub: '' });
      }
    }

    if (paths.video) addRecentPath(paths.video);
    if (paths.sub) addRecentPath(paths.sub);
    if (paths.output) addRecentPath(paths.output);
    runInFlight.current = true;
    setIsRunning(true);
    setIsStopping(false);
    setElapsedSeconds(0);
    setCurrentSubTask('Analyzing file structures and dividing into groups...');
    setNotice(null);
    setProgress({
      active: true,
      currentFile: 'Scanning media structure...',
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
        const effectiveOutputDir =
          result?.output_dir ||
          paths.output ||
          settings.default_output_dir ||
          (paths.video ? getParentFolder(paths.video) : '');
        if (severity === 'success') {
          setToastRemainingMs(TOAST_DURATION_MS);
          setIsToastHovered(false);
        }
        setNotice({
          severity,
          message:
            result?.message ||
            'The task returned no result. Check the terminal.',
          outputDir: effectiveOutputDir,
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
      setCurrentSubTask('');
      processingStartRef.current = null;
      progressHistoryRef.current = [];
      smoothedEtaRef.current = null;
      setEtaSeconds(null);
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

  useEffect(() => {
    handleRunRef.current = handleRun;
  });

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

  const downloadTerminalLogs = async () => {
    try {
      const defaultName = `syncforge_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      await desktopBridge.saveLogs(terminal, defaultName);
    } catch (error) {
      setNotice({ severity: 'error', message: error.message || String(error) });
    }
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
        if (path) {
          addRecentPath(path);
          setPaths((prev) => ({ ...prev, [key]: path }));
          if (key === 'video' || key === 'sub') {
            setFieldErrors((prev) => ({ ...prev, [key]: '' }));
          }
        }
      } catch (error) {
        setNotice({
          severity: 'error',
          message: error.message || String(error),
        });
      }
    }
  };

  const currentVideoTrimmed = (paths.video || '').trim();
  const activeBackendData =
    mediaBackendData && mediaBackendData._forPath === currentVideoTrimmed
      ? mediaBackendData
      : null;
  const mediaSummary = buildQuickMediaSummary(paths.video, activeBackendData);

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

  useEffect(() => {
    currentOverallPercentRef.current = overallPercent;
    if (isRunning && processingStartRef.current) {
      updateEta(overallPercent);
    }
  }, [overallPercent, isRunning]);

  const isLight = resolvedThemeMode === 'light';
  const isDockedRight = isLgUp && terminalDocked && showTerminal;

  const terminalElement = (
    <Terminal
      text={terminal}
      visible={showTerminal}
      onFollowChange={(following) => {
        followTerminalRef.current = following;
      }}
      onCopy={copyTerminalLogs}
      copied={copiedLogs}
      onDownload={downloadTerminalLogs}
      onClear={() => setTerminal('')}
      expanded={terminalHeight > 280}
      onToggleExpand={() =>
        setTerminalHeight((h) => {
          const compactHeight = 230;
          const maxExpand = typeof window !== 'undefined'
            ? Math.max(260, Math.min(420, Math.floor(window.innerHeight * 0.55)))
            : 380;
          return h > 280 ? compactHeight : maxExpand;
        })
      }
      docked={isDockedRight}
      canDock={isLgUp}
      onToggleDock={() => setTerminalDocked((d) => !d)}
      onClose={() => setShowTerminal(false)}
    />
  );

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Box
        data-testid="app-root"
        data-theme-mode={resolvedThemeMode}
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
          backgroundImage: isLight
            ? 'radial-gradient(circle at 85% 10%, rgba(79, 70, 229, 0.05) 0%, transparent 45%), radial-gradient(circle at 20% 90%, rgba(2, 132, 199, 0.04) 0%, transparent 40%)'
            : 'radial-gradient(circle at 85% 10%, rgba(99, 102, 241, 0.10) 0%, transparent 45%), radial-gradient(circle at 20% 90%, rgba(56, 189, 248, 0.06) 0%, transparent 40%)',
        }}
      >
        <Sidebar
          selectedMod={selectedMod}
          onSelect={(mod) => {
            setSelectedMod(mod);
            setFieldErrors({ video: '', sub: '' });
          }}
          running={isRunning}
          hasRun={hasRun}
          onRepeat={() => handleRun(true)}
          settings={settings}
          onSettingsChange={setSettings}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          settingsTab={settingsTab}
          onSettingsTabChange={setSettingsTab}
          shortcuts={shortcuts}
          onShortcutsChange={setShortcuts}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          {/* Scrollable Workspace Content Area */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              px: { xs: 3, md: 4, xl: 5 },
              pt: 3,
              pb: showTerminal && !isDockedRight ? 1.5 : 3,
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
                  borderBottom: isLight
                    ? '1px solid rgba(15, 23, 42, 0.10)'
                    : '1px solid rgba(148, 163, 184, 0.10)',
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
                      background: isLight
                        ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(2, 132, 199, 0.08) 100%)'
                        : 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(56, 189, 248, 0.12) 100%)',
                      border: isLight
                        ? '1px solid rgba(79, 70, 229, 0.28)'
                        : '1px solid rgba(99, 102, 241, 0.35)',
                      color: 'primary.main',
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
                      ? isLight
                        ? 'rgba(79, 70, 229, 0.12)'
                        : 'rgba(99, 102, 241, 0.16)'
                      : isLight
                        ? 'rgba(5, 150, 105, 0.12)'
                        : 'rgba(16, 185, 129, 0.12)',
                    color: isRunning
                      ? 'primary.main'
                      : isLight
                        ? '#047857'
                        : '#34D399',
                    border: '1px solid',
                    borderColor: isRunning
                      ? isLight
                        ? 'rgba(79, 70, 229, 0.3)'
                        : 'rgba(99, 102, 241, 0.35)'
                      : isLight
                        ? 'rgba(5, 150, 105, 0.28)'
                        : 'rgba(16, 185, 129, 0.3)',
                  }}
                />
              </Box>

              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 3, maxWidth: 960, lineHeight: 1.6, fontSize: '0.94rem' }}
              >
                {selectedMod.desc}
              </Typography>

              {/* Responsive Workspace Grid (fills wide & maximized screens cleanly) */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    lg: 'minmax(0, 1.55fr) minmax(300px, 1.05fr)',
                  },
                  gap: 3,
                  alignItems: 'start',
                }}
              >
                {/* Left Column: Path Inputs, Launch Action, and Live Progress */}
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  {/* Path Configuration Card */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      mb: 3,
                      width: '100%',
                      p: 2.5,
                      borderRadius: 2.5,
                      bgcolor: isLight ? '#FAFAFC' : 'rgba(15, 20, 31, 0.72)',
                      border: isLight
                        ? '1px solid rgba(15, 23, 42, 0.10)'
                        : '1px solid rgba(148, 163, 184, 0.12)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    {selectedMod.needs.includes('video') && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <PathInput
                          label={selectedMod.labels[0]}
                          value={paths.video}
                          mediaType="video"
                          disabled={isRunning}
                          error={Boolean(fieldErrors.video)}
                          helperText={fieldErrors.video || undefined}
                          isWindowDragging={isWindowDragging}
                          dropZoneLabel="Drop Video Here"
                          recentPaths={recentPaths}
                          onClearRecentPaths={clearRecentPaths}
                          onChange={(video) => {
                            setPaths((p) => ({ ...p, video }));
                            if (fieldErrors.video) {
                              setFieldErrors((prev) => ({ ...prev, video: '' }));
                            }
                          }}
                          onPick={(kind, type) => handlePickPath('video', kind, type)}
                          onShowInFolder={handleShowInFolder}
                          onDragHoverChange={(hovered) => {
                            hoveredFieldRef.current = hovered ? 'video' : null;
                          }}
                        />
                        {mediaSummary && (
                          <Box
                            data-testid="media-inspector"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 0.75,
                              px: 1.25,
                              py: 0.65,
                              borderRadius: 1.5,
                              bgcolor: isLight ? '#E8ECF2' : 'rgba(11, 15, 24, 0.75)',
                              border: isLight
                                ? '1px solid rgba(15, 23, 42, 0.10)'
                                : '1px solid rgba(148, 163, 184, 0.14)',
                            }}
                          >
                            <Chip
                              size="small"
                              icon={
                                mediaSummary.kind === 'folder' ? (
                                  <FolderOpenOutlined sx={{ fontSize: 13 }} />
                                ) : (
                                  <MovieOutlined sx={{ fontSize: 13 }} />
                                )
                              }
                              label={mediaSummary.badge}
                              sx={{
                                height: 20,
                                fontSize: '0.68rem',
                                fontFamily: 'monospace',
                                fontWeight: 800,
                                bgcolor: isLight
                                  ? 'rgba(79, 70, 229, 0.12)'
                                  : 'rgba(99, 102, 241, 0.18)',
                                color: isLight ? '#4338CA' : '#A5B4FC',
                              }}
                            />
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{
                                fontFamily: 'monospace',
                                color: 'text.secondary',
                                fontSize: '0.74rem',
                                maxWidth: 260,
                              }}
                            >
                              {mediaSummary.name}
                            </Typography>
                            {mediaSummary.videoCount !== undefined && (
                              <Chip
                                size="small"
                                label={`${mediaSummary.videoCount} video(s)`}
                                sx={{
                                  height: 20,
                                  fontSize: '0.68rem',
                                  fontFamily: 'monospace',
                                  bgcolor: isLight
                                    ? 'rgba(2, 132, 199, 0.12)'
                                    : 'rgba(56, 189, 248, 0.12)',
                                  color: 'secondary.main',
                                }}
                              />
                            )}
                            {mediaSummary.videoCodec && (
                              <Chip
                                size="small"
                                label={`Video: ${mediaSummary.videoCodec}`}
                                sx={{
                                  height: 20,
                                  fontSize: '0.68rem',
                                  fontFamily: 'monospace',
                                  bgcolor: isLight
                                    ? 'rgba(15, 23, 42, 0.08)'
                                  : 'rgba(148, 163, 184, 0.12)',
                                  color: 'text.primary',
                                }}
                              />
                            )}
                            {mediaSummary.audioSummary && (
                              <Chip
                                size="small"
                                icon={
                                  <HeadphonesOutlined
                                    sx={{
                                      fontSize: 13,
                                      color: isLight
                                        ? '#047857 !important'
                                        : '#34D399 !important',
                                    }}
                                  />
                                }
                                label={`Audio (${mediaSummary.audioCount}): ${mediaSummary.audioSummary}`}
                                sx={{
                                  height: 20,
                                  fontSize: '0.68rem',
                                  fontFamily: 'monospace',
                                  bgcolor: isLight
                                    ? 'rgba(5, 150, 105, 0.12)'
                                    : 'rgba(52, 211, 153, 0.12)',
                                  color: isLight ? '#047857' : '#34D399',
                                }}
                              />
                            )}
                            {mediaSummary.subSummary && (
                              <Chip
                                size="small"
                                icon={
                                  <SubtitlesOutlined
                                    sx={{
                                      fontSize: 13,
                                      color: isLight
                                        ? '#0284C7 !important'
                                        : '#38BDF8 !important',
                                    }}
                                  />
                                }
                                label={`Subs (${mediaSummary.subCount}): ${mediaSummary.subSummary}`}
                                sx={{
                                  height: 20,
                                  fontSize: '0.68rem',
                                  fontFamily: 'monospace',
                                  bgcolor: isLight
                                    ? 'rgba(2, 132, 199, 0.12)'
                                    : 'rgba(56, 189, 248, 0.12)',
                                  color: 'secondary.main',
                                }}
                              />
                            )}
                          </Box>
                        )}
                      </Box>
                    )}
                    {selectedMod.needs.includes('sub') && (
                      <PathInput
                        label={selectedMod.labels[1]}
                        value={paths.sub}
                        disabled={isRunning}
                        error={Boolean(fieldErrors.sub)}
                        helperText={fieldErrors.sub || undefined}
                        mediaType={
                          selectedMod.id === 'sync_subs' ? 'subtitles' : 'video'
                        }
                        isWindowDragging={isWindowDragging}
                        dropZoneLabel={
                          selectedMod.id === 'sync_subs'
                            ? 'Drop Subtitles Here'
                            : 'Drop Source Video Here'
                        }
                        recentPaths={recentPaths}
                        onClearRecentPaths={clearRecentPaths}
                        onChange={(sub) => {
                          setPaths((p) => ({ ...p, sub }));
                          if (fieldErrors.sub) {
                            setFieldErrors((prev) => ({ ...prev, sub: '' }));
                          }
                        }}
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
                        helperText={
                          !paths.output
                            ? settings.default_output_dir
                              ? `Default: ${settings.default_output_dir}`
                              : 'If not selected, output folder remains the source folder'
                            : undefined
                        }
                        isWindowDragging={isWindowDragging}
                        dropZoneLabel="Drop Output Folder Here"
                        recentPaths={recentPaths}
                        onClearRecentPaths={clearRecentPaths}
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
                    {!isRunning && shortcuts.launch_module && (
                      <Chip
                        size="small"
                        data-testid="launch-shortcut-hint"
                        label={formatShortcutDisplay(shortcuts.launch_module)}
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.70rem',
                          fontWeight: 700,
                          color: 'text.secondary',
                          bgcolor: isLight
                            ? 'rgba(15, 23, 42, 0.06)'
                            : 'rgba(148, 163, 184, 0.08)',
                          border: isLight
                            ? '1px solid rgba(15, 23, 42, 0.14)'
                            : '1px solid rgba(148, 163, 184, 0.18)',
                        }}
                      />
                    )}
                    <Button
                      variant="outlined"
                      size="large"
                      data-testid="open-cli-export-btn"
                      startIcon={<CodeOutlined />}
                      onClick={() => setCliExportOpen(true)}
                      sx={{
                        px: 2.25,
                        py: 1.2,
                        fontWeight: 600,
                        fontSize: '0.86rem',
                        color: 'text.secondary',
                        borderColor: isLight
                          ? 'rgba(15, 23, 42, 0.18)'
                          : 'rgba(148, 163, 184, 0.22)',
                        '&:hover': {
                          color: 'text.primary',
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      CLI Command
                    </Button>
                    {isRunning && (
                      <Button
                        variant="contained"
                        color="error"
                        size="large"
                        data-testid="stop-task-btn"
                        startIcon={<Stop />}
                        onClick={handleStop}
                        disabled={isStopping}
                        sx={{
                          px: 2.75,
                          py: 1.2,
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          bgcolor: 'error.main',
                          color: '#FFFFFF',
                          boxShadow: '0 2px 10px rgba(244, 63, 94, 0.4)',
                          border: '1px solid rgba(244, 63, 94, 0.5)',
                          '&:hover': {
                            bgcolor: 'error.dark',
                            boxShadow: '0 4px 14px rgba(244, 63, 94, 0.55)',
                          },
                          '&.Mui-disabled': {
                            bgcolor: 'rgba(244, 63, 94, 0.5)',
                            color: 'rgba(255, 255, 255, 0.7)',
                          },
                        }}
                      >
                        {isStopping ? 'Stopping...' : 'Stop task'}
                      </Button>
                    )}
                  </Box>

                  {/* Progress Section: Overall, Current File, and Sub-task CLI Transparency */}
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
                            width: '100%',
                            p: 2,
                            borderRadius: 2,
                            bgcolor: isLight ? '#FAFAFC' : 'rgba(15, 20, 31, 0.85)',
                            border: isLight
                              ? '1px solid rgba(79, 70, 229, 0.28)'
                              : '1px solid rgba(99, 102, 241, 0.25)',
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
                                  color: 'primary.main',
                                  fontSize: '0.82rem',
                                }}
                              >
                                {progress.totalFiles > 0
                                  ? `File ${progress.fileIndex} of ${progress.totalFiles} (${Math.round(overallPercent)}%)`
                                  : isStopping
                                    ? 'Stopping...'
                                    : currentSubTask || 'Analyzing file structures and dividing into groups...'}
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant={progress.totalFiles > 0 ? 'determinate' : 'indeterminate'}
                              value={overallPercent}
                              aria-label="Overall Progress"
                              sx={{
                                height: 7,
                                borderRadius: 4,
                                bgcolor: isLight
                                  ? 'rgba(15, 23, 42, 0.08)'
                                  : 'rgba(255, 255, 255, 0.08)',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                  background:
                                    'linear-gradient(90deg, #6366F1 0%, #38BDF8 100%)',
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
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  minWidth: 0,
                                  mr: 1,
                                }}
                              >
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
                                    maxWidth: { xs: 260, sm: 360, md: 520 },
                                  }}
                                >
                                  {progress.currentFile || 'Scanning media structure...'}
                                </Typography>
                              </Box>
                              <Typography
                                variant="body2"
                                data-testid="file-progress-label"
                                sx={{
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: 'secondary.main',
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
                                bgcolor: isLight
                                  ? 'rgba(15, 23, 42, 0.08)'
                                  : 'rgba(255, 255, 255, 0.08)',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                  background:
                                    'linear-gradient(90deg, #38BDF8 0%, #34D399 100%)',
                                },
                              }}
                            />
                          </Box>

                          {/* Sub-task CLI Transparency Indicator */}
                          <Box
                            data-testid="subtask-indicator"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1,
                              pt: 0.75,
                              borderTop: isLight
                                ? '1px solid rgba(15, 23, 42, 0.08)'
                                : '1px solid rgba(148, 163, 184, 0.10)',
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                minWidth: 0,
                              }}
                            >
                              <CircularProgress
                                size={12}
                                thickness={5}
                                sx={{ color: 'secondary.main', flexShrink: 0 }}
                              />
                              <Typography
                                variant="caption"
                                data-testid="subtask-label"
                                noWrap
                                sx={{
                                  fontFamily: 'monospace',
                                  color: 'text.secondary',
                                  fontSize: '0.75rem',
                                }}
                              >
                                {currentSubTask || 'Executing pipeline subprocess...'}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              data-testid="view-live-console-btn"
                              onClick={() => setShowTerminal(true)}
                              sx={{
                                fontSize: '0.72rem',
                                py: 0.15,
                                px: 0.85,
                                minWidth: 0,
                                flexShrink: 0,
                                color: 'secondary.main',
                              }}
                            >
                              View live console
                            </Button>
                          </Box>
                        </Box>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Box>

                {/* Right Column: Active Profile, Stream & Telemetry Inspector, and Dockable Console */}
                <Box
                  data-testid="workspace-overview-card"
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    p: 2.25,
                    borderRadius: 2.5,
                    bgcolor: isLight ? '#FAFAFC' : 'rgba(15, 20, 31, 0.55)',
                    border: isLight
                      ? '1px solid rgba(15, 23, 42, 0.10)'
                      : '1px solid rgba(148, 163, 184, 0.10)',
                    backdropFilter: 'blur(10px)',
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TuneOutlined sx={{ fontSize: 17, color: 'primary.main' }} />
                      <Typography
                        component="h4"
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{
                          fontSize: '0.78rem',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: isLight ? '#4338CA' : '#A5B4FC',
                        }}
                      >
                        Active Profile
                      </Typography>
                    </Box>
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      '& .MuiButton-root': {
                        height: 28,
                        fontSize: '0.72rem',
                        lineHeight: 1,
                        py: 0,
                        px: 1,
                        minWidth: 0,
                        whiteSpace: 'nowrap',
                      },
                      '& .MuiButton-startIcon > svg': { fontSize: 14 },
                    }}>
                      {isLgUp && (
                        <Button
                          size="small"
                          data-testid="dock-terminal-toggle"
                          startIcon={<ViewSidebarOutlined sx={{ fontSize: 14 }} />}
                          onClick={() => {
                            if (!showTerminal) {
                              setShowTerminal(true);
                              setTerminalDocked(true);
                            } else {
                              setTerminalDocked((d) => !d);
                            }
                          }}
                          sx={{
                            color: isDockedRight ? 'secondary.main' : 'text.secondary',
                          }}
                        >
                          {isDockedRight ? 'Bottom Drawer' : 'Dock Console'}
                        </Button>
                      )}
                      <Button
                        size="small"
                        aria-label="Configure active profile"
                        onClick={() => {
                          setSettingsTab('general');
                          setSettingsOpen(true);
                        }}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': { color: 'text.primary' },
                        }}
                      >
                        Configure
                      </Button>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {['stream_manager', 'injection', 'custom_merge', 'internal_sync'].includes(
                      selectedMod.id
                    ) && (
                      <Chip
                        size="small"
                        label={`Opus: ${
                          settings.opus_mode === 'always'
                            ? `Always (${settings.opus_bitrate || 128}k${settings.opus_downmix === false ? ' multi' : ' 2.0'})`
                            : settings.opus_mode === 'prompt'
                              ? `Prompt (${settings.opus_bitrate || 128}k${settings.opus_downmix === false ? ' multi' : ' 2.0'})`
                              : 'Off'
                        }`}
                        sx={{
                          height: 22,
                          fontSize: '0.70rem',
                          fontFamily: 'monospace',
                          bgcolor:
                            settings.opus_mode && settings.opus_mode !== 'off'
                              ? isLight
                                ? 'rgba(5, 150, 105, 0.12)'
                                : 'rgba(52, 211, 153, 0.14)'
                              : isLight
                                ? 'rgba(15, 23, 42, 0.06)'
                                : 'rgba(148, 163, 184, 0.08)',
                          color:
                            settings.opus_mode && settings.opus_mode !== 'off'
                              ? isLight
                                ? '#047857'
                                : '#34D399'
                              : 'text.secondary',
                        }}
                      />
                    )}
                    {['injection', 'internal_sync'].includes(selectedMod.id) && (
                      <Chip
                        size="small"
                        label={`Audio Sync: ${settings.auto_audio ? 'Auto' : 'Manual'}`}
                        sx={{
                          height: 22,
                          fontSize: '0.70rem',
                          fontFamily: 'monospace',
                          bgcolor: settings.auto_audio
                            ? isLight
                              ? 'rgba(5, 150, 105, 0.12)'
                              : 'rgba(52, 211, 153, 0.14)'
                            : isLight
                              ? 'rgba(15, 23, 42, 0.06)'
                              : 'rgba(148, 163, 184, 0.08)',
                          color: settings.auto_audio
                            ? isLight
                              ? '#047857'
                              : '#34D399'
                            : 'text.secondary',
                        }}
                      />
                    )}
                    {['injection', 'sync_subs', 'sync_subs_mkv', 'internal_sync'].includes(
                      selectedMod.id
                    ) && (
                      <>
                        <Chip
                          size="small"
                          label={`Sub Sync: ${settings.auto_subs ? 'Auto' : 'Off'}`}
                          sx={{
                            height: 22,
                            fontSize: '0.70rem',
                            fontFamily: 'monospace',
                            bgcolor: settings.auto_subs
                              ? isLight
                                ? 'rgba(2, 132, 199, 0.12)'
                                : 'rgba(56, 189, 248, 0.14)'
                              : isLight
                                ? 'rgba(15, 23, 42, 0.06)'
                                : 'rgba(148, 163, 184, 0.08)',
                            color: settings.auto_subs ? 'secondary.main' : 'text.secondary',
                          }}
                        />
                        <Chip
                          size="small"
                          label={
                            settings.enable_max_offset
                              ? `Max Offset: ${settings.max_offset}s`
                              : 'Max Offset: Unlimited'
                          }
                          sx={{
                            height: 22,
                            fontSize: '0.70rem',
                            fontFamily: 'monospace',
                            bgcolor: isLight
                              ? 'rgba(15, 23, 42, 0.06)'
                              : 'rgba(148, 163, 184, 0.08)',
                            color: 'text.secondary',
                          }}
                        />
                        {settings.preview_mpv && (
                          <Chip
                            size="small"
                            label="mpv Preview: On"
                            sx={{
                              height: 22,
                              fontSize: '0.70rem',
                              fontFamily: 'monospace',
                              bgcolor: isLight
                                ? 'rgba(2, 132, 199, 0.12)'
                                : 'rgba(56, 189, 248, 0.14)',
                              color: 'secondary.main',
                            }}
                          />
                        )}
                      </>
                    )}
                    <Chip
                      size="small"
                      label={`Notifications: ${settings.notify_on_finish ? 'On' : 'Off'}`}
                      sx={{
                        height: 22,
                        fontSize: '0.70rem',
                        fontFamily: 'monospace',
                        bgcolor: settings.notify_on_finish
                          ? isLight
                            ? 'rgba(5, 150, 105, 0.12)'
                            : 'rgba(52, 211, 153, 0.14)'
                          : isLight
                            ? 'rgba(15, 23, 42, 0.06)'
                            : 'rgba(148, 163, 184, 0.08)',
                        color: settings.notify_on_finish
                          ? isLight
                            ? '#047857'
                            : '#34D399'
                          : 'text.secondary',
                      }}
                    />
                  </Box>

                  {/* Dynamic Active Stream & Telemetry Inspector */}
                  <Box
                    data-testid="stream-telemetry-inspector"
                    sx={{
                      pt: 1.5,
                      borderTop: isLight
                        ? '1px solid rgba(15, 23, 42, 0.08)'
                        : '1px solid rgba(148, 163, 184, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <GraphicEq sx={{ fontSize: 16, color: 'secondary.main' }} />
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{
                            fontSize: '0.72rem',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'text.secondary',
                          }}
                        >
                          Stream & Telemetry Inspector
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.72rem',
                          color: isRunning ? 'secondary.main' : 'text.secondary',
                        }}
                      >
                        {isRunning
                          ? `LIVE • ${formatDuration(elapsedSeconds)}`
                          : mediaSummary
                            ? mediaSummary.badge
                            : 'STANDBY'}
                      </Typography>
                    </Box>

                    {mediaSummary ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 0.75,
                        }}
                      >
                        <Box
                          sx={{
                            px: 1,
                            py: 0.6,
                            borderRadius: 1.25,
                            bgcolor: isLight ? '#E8ECF2' : 'rgba(11, 15, 24, 0.55)',
                            border: isLight
                              ? '1px solid rgba(15, 23, 42, 0.08)'
                              : '1px solid rgba(148, 163, 184, 0.08)',
                          }}
                        >
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block' }}>
                            Source Container
                          </Typography>
                          <Typography variant="caption" noWrap sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem', color: 'text.primary' }}>
                            {mediaSummary.videoCodec ? `${mediaSummary.badge} • ${mediaSummary.videoCodec}` : mediaSummary.badge}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            px: 1,
                            py: 0.6,
                            borderRadius: 1.25,
                            bgcolor: isLight ? '#E8ECF2' : 'rgba(11, 15, 24, 0.55)',
                            border: isLight
                              ? '1px solid rgba(15, 23, 42, 0.08)'
                              : '1px solid rgba(148, 163, 184, 0.08)',
                          }}
                        >
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', display: 'block' }}>
                            Audio & Sub Streams
                          </Typography>
                          <Typography variant="caption" noWrap sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem', color: 'text.primary' }}>
                            {mediaSummary.kind === 'folder'
                              ? `${mediaSummary.videoCount ?? 0} video(s)`
                              : `${mediaSummary.audioCount || 0} Aud / ${mediaSummary.subCount || 0} Sub`}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.73rem',
                          px: 1,
                          py: 0.75,
                          borderRadius: 1.25,
                          bgcolor: isLight ? '#E8ECF2' : 'rgba(11, 15, 24, 0.45)',
                          border: isLight
                            ? '1px solid rgba(15, 23, 42, 0.08)'
                            : '1px solid rgba(148, 163, 184, 0.08)',
                        }}
                      >
                        {isRunning
                          ? currentSubTask || 'Executing media pipeline...'
                          : 'Select or drop a media source to inspect container streams, codecs, and track flags.'}
                      </Typography>
                    )}
                  </Box>

                  <Box
                    sx={{
                      pt: 1.5,
                      borderTop: isLight
                        ? '1px solid rgba(15, 23, 42, 0.08)'
                        : '1px solid rgba(148, 163, 184, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <KeyboardOutlined sx={{ fontSize: 16, color: 'secondary.main' }} />
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{
                            fontSize: '0.72rem',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: 'text.secondary',
                          }}
                        >
                          Quick Shortcuts
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        aria-label="Customize keyboard shortcuts"
                        onClick={() => {
                          setSettingsTab('shortcuts');
                          setSettingsOpen(true);
                        }}
                        sx={{
                          fontSize: '0.72rem',
                          py: 0.25,
                          px: 1,
                          minWidth: 0,
                          color: 'text.secondary',
                          '&:hover': { color: 'text.primary' },
                        }}
                      >
                        Customize
                      </Button>
                    </Box>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 0.75,
                      }}
                    >
                      {[
                        { label: 'Launch', combo: shortcuts.launch_module },
                        { label: 'Repeat', combo: shortcuts.repeat_last },
                        { label: 'Settings', combo: shortcuts.open_settings },
                        { label: 'Console', combo: shortcuts.toggle_terminal },
                      ].map((sc) => (
                        <Box
                          key={sc.label}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 1,
                            py: 0.5,
                            borderRadius: 1.25,
                            bgcolor: isLight ? '#E8ECF2' : 'rgba(11, 15, 24, 0.55)',
                            border: isLight
                              ? '1px solid rgba(15, 23, 42, 0.08)'
                              : '1px solid rgba(148, 163, 184, 0.08)',
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
                          >
                            {sc.label}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.72rem',
                              color: sc.combo ? 'text.primary' : 'text.secondary',
                            }}
                          >
                            {formatShortcutDisplay(sc.combo) || '—'}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  {/* Side-by-Side Docked Terminal on lg+ */}
                  {isDockedRight && (
                    <Box
                      data-testid="docked-terminal-container"
                      sx={{
                        height: terminalHeight > 280 ? 420 : 320,
                        mt: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {terminalElement}
                    </Box>
                  )}
                </Box>
              </Box>
            </motion.div>
          </AnimatePresence>
        </Box>

        {/* Developer Console Bottom Drawer (pinned to bottom of viewport when not docked to right column) */}
        {!isDockedRight && (
          <Box
            sx={{
              height: showTerminal ? `calc(${terminalHeight}px + 14px)` : 0,
              maxHeight: showTerminal ? '65vh' : 0,
              overflow: 'hidden',
              px: { xs: 3, md: 4, xl: 5 },
              pb: showTerminal ? 2 : 0,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              transition: isTerminalDragging
                ? 'none'
                : 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Box
              role="separator"
              aria-label="Resize terminal"
              aria-orientation="horizontal"
              onMouseDown={(e) => {
                terminalDraggingRef.current = true;
                setIsTerminalDragging(true);
                terminalDragStartYRef.current = e.clientY;
                terminalDragStartHeightRef.current = terminalHeight;
                document.body.style.cursor = 'row-resize';
                document.body.style.userSelect = 'none';
              }}
              sx={{
                height: 6,
                mb: 0.75,
                cursor: 'row-resize',
                borderRadius: 1,
                bgcolor: isLight
                  ? 'rgba(15, 23, 42, 0.12)'
                  : 'rgba(148, 163, 184, 0.12)',
                transition: 'background-color 0.15s ease',
                '&:hover': { bgcolor: 'primary.main' },
              }}
            />
            <Box
              sx={{
                height: terminalHeight,
                minHeight: 140,
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
              }}
            >
              {terminalElement}
            </Box>
          </Box>
        )}

        {!isDockedRight && !showTerminal && (
          <Box
            sx={{
              px: { xs: 3, md: 4, xl: 5 },
              py: 0.85,
              borderTop: isLight
                ? '1px solid rgba(15, 23, 42, 0.08)'
                : '1px solid rgba(148, 163, 184, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              bgcolor: isLight
                ? 'rgba(248, 250, 252, 0.85)'
                : 'rgba(11, 15, 24, 0.75)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Button
              size="small"
              startIcon={<TerminalIcon fontSize="small" />}
              onClick={() => setShowTerminal(true)}
              sx={{
                color: 'text.secondary',
                '&:hover': { color: 'text.primary' },
                fontSize: '0.75rem',
              }}
            >
              Show Terminal
            </Button>
          </Box>
        )}
      </Box>
      </Box>

      {inputRequest && inputRequest.kind === 'sync_preview' && (
        <SyncPreviewDialog
          key={inputRequest.callback_id}
          request={inputRequest}
          onResolve={resolveInput}
          onStop={handleStop}
          stopping={isStopping}
        />
      )}
      {inputRequest && inputRequest.kind !== 'sync_preview' && (
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
      <CliExportDialog
        open={cliExportOpen}
        onClose={() => setCliExportOpen(false)}
        selectedMod={selectedMod}
        paths={paths}
        settings={settings}
      />

      {/* Non-blocking Foreground-Aware Toast for Successful Task Completion */}
      <AnimatePresence>
        {notice?.severity === 'success' && (
          <motion.div
            key="completion-toast"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              right: 24,
              bottom: 24,
              zIndex: 1400,
              width: 'min(440px, calc(100vw - 48px))',
            }}
          >
            <Box
              data-testid="completion-toast"
              onMouseEnter={() => setIsToastHovered(true)}
              onMouseLeave={() => setIsToastHovered(false)}
              sx={{
                bgcolor: isLight ? '#FAFAFC' : '#0E1422',
                border: isLight
                  ? '1px solid rgba(5, 150, 105, 0.45)'
                  : '1px solid rgba(52, 211, 153, 0.45)',
                borderRadius: 2.5,
                boxShadow: isLight
                  ? '0 20px 50px rgba(15, 23, 42, 0.18)'
                  : '0 20px 50px rgba(0, 0, 0, 0.75)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  px: 2,
                  pt: 1.5,
                  pb: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ color: isLight ? '#047857' : '#34D399' }}
                >
                  Task completed
                </Typography>
                <Typography
                  variant="caption"
                  data-testid="toast-timer-status"
                  sx={{ fontFamily: 'monospace', color: 'text.secondary', fontSize: '0.72rem' }}
                >
                  {!isWindowFocused || isToastHovered
                    ? `Paused (${(toastRemainingMs / 1000).toFixed(1)}s)`
                    : `${(toastRemainingMs / 1000).toFixed(1)}s`}
                </Typography>
              </Box>
              <Box sx={{ px: 2, py: 1 }}>
                <Alert severity="success" sx={{ borderRadius: 1.5 }}>
                  {notice.message}
                </Alert>
              </Box>
              <Box
                sx={{
                  px: 2,
                  pb: 1.5,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1,
                }}
              >
                {Boolean(
                  notice.outputDir ||
                    paths.output ||
                    settings.default_output_dir ||
                    paths.video
                ) && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FolderOpenOutlined fontSize="small" />}
                    onClick={() =>
                      handleShowInFolder(
                        notice.outputDir ||
                          paths.output ||
                          settings.default_output_dir ||
                          getParentFolder(paths.video)
                      )
                    }
                  >
                    Show in Folder
                  </Button>
                )}
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => setNotice(null)}
                >
                  OK
                </Button>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, (toastRemainingMs / TOAST_DURATION_MS) * 100))}
                aria-label="Toast auto-dismiss countdown"
                data-testid="toast-countdown-bar"
                sx={{
                  height: 5,
                  bgcolor: 'rgba(52, 211, 153, 0.14)',
                  '& .MuiLinearProgress-bar': {
                    transition: 'none',
                    background: 'linear-gradient(90deg, #34D399 0%, #38BDF8 100%)',
                  },
                }}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Dialog for Warnings, Errors, and Task Cancellation */}
      <Dialog
        open={Boolean(notice && notice.severity !== 'success')}
        onClose={() => setNotice(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {notice?.severity === 'warning'
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
          {notice?.severity === 'warning' &&
            Boolean(notice?.outputDir || paths.output || settings.default_output_dir || paths.video) && (
              <Button
                variant="outlined"
                startIcon={<FolderOpenOutlined fontSize="small" />}
                onClick={() =>
                  handleShowInFolder(
                    notice?.outputDir ||
                    paths.output ||
                    settings.default_output_dir ||
                    getParentFolder(paths.video)
                  )
                }
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
