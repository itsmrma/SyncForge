import { useEffect, useState } from 'react';
import {
  Typography,
  FormControlLabel,
  Checkbox,
  TextField,
  MenuItem,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Tooltip,
  Divider,
  Chip,
} from '@mui/material';
import Settings from '@mui/icons-material/Settings';
import Close from '@mui/icons-material/Close';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import RestartAlt from '@mui/icons-material/RestartAlt';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { desktopBridge } from '../bridge';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_GROUPS,
  ALL_SHORTCUT_ITEMS,
  formatEventToShortcut,
  splitShortcutKeys,
} from '../shortcuts';

export default function SettingsDialog({
  open,
  onClose,
  _selectedMod,
  settings,
  onChange,
  shortcuts = DEFAULT_SHORTCUTS,
  onShortcutsChange,
  initialTab = 'general',
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'general');
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  const [editingShortcut, setEditingShortcut] = useState(null);
  const [conflictState, setConflictState] = useState(null);

  if ((open && !prevOpen) || (initialTab !== prevInitialTab)) {
    setPrevOpen(open);
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab || 'general');
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const updateShortcuts = (next) => {
    if (onShortcutsChange) {
      onShortcutsChange(next);
    }
  };

  useEffect(() => {
    if (!open || editingShortcut || conflictState) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveTab('general');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, editingShortcut, conflictState]);

  useEffect(() => {
    if (!open || !editingShortcut || conflictState) return;
    const handleCaptureKeyDown = (e) => {
      const combo = formatEventToShortcut(e);
      if (!combo) return;
      e.preventDefault();
      e.stopPropagation();

      const conflictingItem = ALL_SHORTCUT_ITEMS.find(
        (item) =>
          item.id !== editingShortcut.id &&
          (shortcuts[item.id] || '').toLowerCase() === combo.toLowerCase()
      );

      if (conflictingItem) {
        setConflictState({
          targetId: editingShortcut.id,
          targetLabel: editingShortcut.label,
          conflictingId: conflictingItem.id,
          conflictingLabel: conflictingItem.label,
          combo,
        });
      } else {
        onShortcutsChange?.({
          ...shortcuts,
          [editingShortcut.id]: combo,
        });
        setEditingShortcut(null);
      }
    };
    window.addEventListener('keydown', handleCaptureKeyDown, true);
    return () => window.removeEventListener('keydown', handleCaptureKeyDown, true);
  }, [open, editingShortcut, conflictState, shortcuts, onShortcutsChange]);

  if (!open) return null;

  const handlePickDefaultOutputDir = async () => {
    try {
      const chosen = await desktopBridge.pickFolder(settings.default_output_dir);
      if (chosen) {
        onChange({ ...settings, default_output_dir: chosen });
      }
    } catch (err) {
      console.error('Failed to pick default output folder', err);
    }
  };

  const handleClearDefaultOutputDir = () => {
    onChange({ ...settings, default_output_dir: '' });
  };

  const handleResetSingleShortcut = (item) => {
    const defaultCombo = DEFAULT_SHORTCUTS[item.id];
    const conflictingItem = ALL_SHORTCUT_ITEMS.find(
      (other) =>
        other.id !== item.id &&
        (shortcuts[other.id] || '').toLowerCase() === defaultCombo.toLowerCase()
    );
    if (conflictingItem) {
      setConflictState({
        targetId: item.id,
        targetLabel: item.label,
        conflictingId: conflictingItem.id,
        conflictingLabel: conflictingItem.label,
        combo: defaultCombo,
      });
    } else {
      updateShortcuts({
        ...shortcuts,
        [item.id]: defaultCombo,
      });
    }
  };

  const handleResetAllShortcuts = () => {
    updateShortcuts({ ...DEFAULT_SHORTCUTS });
    setEditingShortcut(null);
    setConflictState(null);
  };

  const modifiedCount = ALL_SHORTCUT_ITEMS.filter(
    (item) => (shortcuts[item.id] ?? DEFAULT_SHORTCUTS[item.id]) !== DEFAULT_SHORTCUTS[item.id]
  ).length;

  return (
    <Box
      role="dialog"
      aria-label="Settings"
      aria-modal="true"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        p: 2,
        animation: 'fadeIn 0.15s ease-out',
        '@keyframes fadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !editingShortcut && !conflictState) {
          onClose();
        }
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '88vh',
          bgcolor: '#0E131F',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: 3,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          '@keyframes scaleUp': {
            from: { transform: 'scale(0.96)', opacity: 0 },
            to: { transform: 'scale(1)', opacity: 1 },
          },
        }}
      >
        {/* Unified Header & Segmented Tab Bar */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
            px: 3,
            pt: 2.25,
            pb: 2,
            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
            bgcolor: '#0E131F',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 2,
                  bgcolor: 'rgba(99, 102, 241, 0.16)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  color: '#818CF8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Settings fontSize="small" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.05rem', lineHeight: 1.2 }}>
                  Settings
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.73rem' }}>
                  Global preferences, module transcoding rules, and customizable keyboard shortcuts
                </Typography>
              </Box>
            </Box>
            <IconButton
              size="small"
              aria-label="Close settings"
              onClick={onClose}
              sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {/* Uniform Segmented Tab Control */}
          <Box
            role="tablist"
            aria-label="Settings pages"
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0.75,
              p: 0.5,
              borderRadius: 2,
              bgcolor: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(148, 163, 184, 0.14)',
            }}
          >
            <Button
              role="tab"
              aria-selected={activeTab === 'general'}
              size="small"
              disableElevation
              startIcon={<TuneOutlined fontSize="small" />}
              onClick={() => setActiveTab('general')}
              sx={{
                borderRadius: 1.5,
                py: 0.75,
                fontSize: '0.80rem',
                fontWeight: 700,
                textTransform: 'none',
                color: activeTab === 'general' ? '#E2E8F0' : 'text.secondary',
                bgcolor:
                  activeTab === 'general'
                    ? 'rgba(99, 102, 241, 0.22)'
                    : 'transparent',
                border: '1px solid',
                borderColor:
                  activeTab === 'general'
                    ? 'rgba(99, 102, 241, 0.45)'
                    : 'transparent',
                '&:hover': {
                  bgcolor:
                    activeTab === 'general'
                      ? 'rgba(99, 102, 241, 0.28)'
                      : 'rgba(255, 255, 255, 0.04)',
                  color: '#E2E8F0',
                },
              }}
            >
              General
            </Button>
            <Button
              role="tab"
              aria-selected={activeTab === 'shortcuts'}
              size="small"
              disableElevation
              startIcon={<KeyboardOutlined fontSize="small" />}
              onClick={() => setActiveTab('shortcuts')}
              sx={{
                borderRadius: 1.5,
                py: 0.75,
                fontSize: '0.80rem',
                fontWeight: 700,
                textTransform: 'none',
                color: activeTab === 'shortcuts' ? '#E2E8F0' : 'text.secondary',
                bgcolor:
                  activeTab === 'shortcuts'
                    ? 'rgba(99, 102, 241, 0.22)'
                    : 'transparent',
                border: '1px solid',
                borderColor:
                  activeTab === 'shortcuts'
                    ? 'rgba(99, 102, 241, 0.45)'
                    : 'transparent',
                '&:hover': {
                  bgcolor:
                    activeTab === 'shortcuts'
                      ? 'rgba(99, 102, 241, 0.28)'
                      : 'rgba(255, 255, 255, 0.04)',
                  color: '#E2E8F0',
                },
              }}
            >
              Keyboard Shortcuts
              {modifiedCount > 0 && (
                <Chip
                  size="small"
                  label={modifiedCount}
                  sx={{
                    ml: 1,
                    height: 18,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    bgcolor: 'rgba(245, 158, 11, 0.2)',
                    color: '#FBBF24',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                  }}
                />
              )}
            </Button>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {activeTab === 'general' ? (
            <>
              {/* Section 1: Audio & Transcoding */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <HeadphonesOutlined sx={{ color: '#34D399', fontSize: 18 }} />
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{
                      color: '#34D399',
                      fontSize: '0.82rem',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Audio & Transcoding
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 0.5 }}>
                  <Box>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      label="Opus Audio Encoding (128 kbps stereo)"
                      value={settings.opus_mode || 'off'}
                      onChange={(e) => onChange({ ...settings, opus_mode: e.target.value })}
                      helperText="Re-encode kept and merged audio tracks to stereo Opus 128k to save space (applied to audio muxing modes)"
                      sx={{
                        '& .MuiFormHelperText-root': {
                          color: 'text.secondary',
                          fontSize: '0.70rem',
                        },
                      }}
                    >
                      <MenuItem value="off">Disabled (Keep original audio lossless)</MenuItem>
                      <MenuItem value="prompt">Ask per batch (Interactive prompt with preview)</MenuItem>
                      <MenuItem value="always">Always convert (Opus 128k stereo)</MenuItem>
                    </TextField>
                  </Box>

                  <Box component="span" sx={{ display: 'block' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={Boolean(settings.auto_audio ?? true)}
                          onChange={(e) =>
                            onChange({ ...settings, auto_audio: e.target.checked })
                          }
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography fontSize="0.82rem">Auto-sync Audio</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.70rem',
                              lineHeight: 1.2,
                            }}
                          >
                            Waveform cross-correlation delay calculation (applied when merging audio)
                          </Typography>
                        </Box>
                      }
                      sx={{ width: '100%', mr: 0 }}
                    />
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.10)' }} />

              {/* Section 2: Subtitles & Timing */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <SubtitlesOutlined sx={{ color: '#38BDF8', fontSize: 18 }} />
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{
                      color: '#38BDF8',
                      fontSize: '0.82rem',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Subtitles & Synchronization
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pl: 0.5 }}>
                  <Box component="span" sx={{ display: 'block' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={Boolean(settings.auto_subs ?? true)}
                          onChange={(e) =>
                            onChange({ ...settings, auto_subs: e.target.checked })
                          }
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography fontSize="0.82rem">Auto-sync Subs</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.70rem',
                              lineHeight: 1.2,
                            }}
                          >
                            Align subtitles to audio speech with FFsubsync (applied to subtitle modes)
                          </Typography>
                        </Box>
                      }
                      sx={{ width: '100%', mr: 0 }}
                    />
                  </Box>

                  <Box component="span" sx={{ display: 'block' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={Boolean(settings.enable_max_offset)}
                          onChange={(e) =>
                            onChange({ ...settings, enable_max_offset: e.target.checked })
                          }
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography fontSize="0.82rem">Enable Max Offset limit</Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.70rem',
                              lineHeight: 1.2,
                            }}
                          >
                            Cap maximum alignment search window in seconds (applied to subtitle modes)
                          </Typography>
                        </Box>
                      }
                      sx={{ width: '100%', mr: 0 }}
                    />
                  </Box>

                  <TextField
                    label="FFsubsync Max Offset (seconds)"
                    type="number"
                    size="small"
                    fullWidth
                    disabled={!settings.enable_max_offset}
                    value={settings.max_offset}
                    onChange={(e) => onChange({ ...settings, max_offset: e.target.value })}
                    helperText="Restricts ffsubsync alignment search to this maximum number of seconds"
                    sx={{
                      '& .MuiFormHelperText-root': { fontSize: '0.70rem' },
                    }}
                  />
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.10)' }} />

              {/* Section 3: Output Directory */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <FolderOpenOutlined sx={{ color: '#F59E0B', fontSize: 18 }} />
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{
                      color: '#F59E0B',
                      fontSize: '0.82rem',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Default Output Directory
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 0.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Default Output Folder"
                      value={settings.default_output_dir || ''}
                      placeholder="Defaults to source folder if empty"
                      onChange={(e) =>
                        onChange({ ...settings, default_output_dir: e.target.value })
                      }
                      helperText={
                        settings.default_output_dir
                          ? 'All processed files will default to this folder'
                          : 'If not configured, output files default to the source video folder'
                      }
                      slotProps={{
                        input: {
                          endAdornment: settings.default_output_dir ? (
                            <InputAdornment position="end">
                              <Tooltip title="Clear default output folder" arrow>
                                <IconButton
                                  size="small"
                                  aria-label="Clear default output folder"
                                  onClick={handleClearDefaultOutputDir}
                                  edge="end"
                                  sx={{ p: 0.5, color: 'text.secondary' }}
                                >
                                  <ClearIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          ) : null,
                        },
                      }}
                      sx={{
                        '& .MuiFormHelperText-root': { fontSize: '0.70rem' },
                      }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<FolderOpenOutlined fontSize="small" />}
                      onClick={handlePickDefaultOutputDir}
                      sx={{ flexShrink: 0, height: 40, px: 2 }}
                    >
                      Browse
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.10)' }} />

              {/* Section 4: Notifications & Feedback */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <NotificationsActiveOutlined sx={{ color: '#A855F7', fontSize: 18 }} />
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{
                      color: '#A855F7',
                      fontSize: '0.82rem',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Notifications & Sound
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 0.5 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={Boolean(settings.notify_on_finish ?? true)}
                        onChange={(e) =>
                          onChange({ ...settings, notify_on_finish: e.target.checked })
                        }
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography fontSize="0.82rem">Notify when task finishes</Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontSize: '0.70rem' }}
                        >
                          Displays a desktop notification when processing completes
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%', mr: 0 }}
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={Boolean(settings.sound_on_finish ?? true)}
                        onChange={(e) =>
                          onChange({ ...settings, sound_on_finish: e.target.checked })
                        }
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography fontSize="0.82rem">Play sound on completion</Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontSize: '0.70rem' }}
                        >
                          Plays a gentle chime on success or alert sound on error
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%', mr: 0 }}
                  />
                </Box>
              </Box>

              {/* Portable Mode Note */}
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <InfoOutlined sx={{ color: '#38BDF8', fontSize: 16 }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#38BDF8' }}>
                    Portable Mode & External Tools
                  </Typography>
                </Box>
                <Typography
                  sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.4 }}
                >
                  SyncForge automatically detects MKVToolNix (
                  <code style={{ color: '#E2E8F0' }}>mkvmerge</code>,{' '}
                  <code style={{ color: '#E2E8F0' }}>mkvextract</code>,{' '}
                  <code style={{ color: '#E2E8F0' }}>mkvpropedit</code>), FFmpeg (
                  <code style={{ color: '#E2E8F0' }}>ffmpeg</code>), and ffsubsync (
                  <code style={{ color: '#E2E8F0' }}>ffsubsync</code>). You can install them
                  system-wide or simply place their executables directly in the application folder
                  (or a <code style={{ color: '#E2E8F0' }}>tools/</code> or{' '}
                  <code style={{ color: '#E2E8F0' }}>bin/</code> subfolder) for full portability
                  without installing anything.
                </Typography>
              </Box>
            </>
          ) : (
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}
              data-testid="shortcuts-page"
            >
              {/* Shortcuts Toolbar */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  bgcolor: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid rgba(148, 163, 184, 0.12)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EditOutlined sx={{ fontSize: 16, color: '#818CF8' }} />
                  <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                    Click any shortcut row to remap it.
                    {modifiedCount > 0 ? ` (${modifiedCount} customized)` : ''}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  aria-label="Reset all shortcuts"
                  disabled={modifiedCount === 0}
                  startIcon={<RestartAlt fontSize="small" />}
                  onClick={handleResetAllShortcuts}
                  sx={{
                    fontSize: '0.73rem',
                    py: 0.35,
                    px: 1.25,
                    flexShrink: 0,
                  }}
                >
                  Reset All
                </Button>
              </Box>

              {SHORTCUT_GROUPS.map((group) => (
                <Box key={group.category}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <KeyboardOutlined sx={{ color: group.color, fontSize: 18 }} />
                    <Typography
                      variant="subtitle2"
                      fontWeight={700}
                      sx={{
                        color: group.color,
                        fontSize: '0.80rem',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {group.category}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.6,
                      bgcolor: 'rgba(11, 15, 24, 0.7)',
                      border: '1px solid rgba(148, 163, 184, 0.12)',
                      borderRadius: 2,
                      p: 1,
                    }}
                  >
                    {group.items.map((item) => {
                      const combo = shortcuts[item.id] ?? DEFAULT_SHORTCUTS[item.id];
                      const isModified = combo !== DEFAULT_SHORTCUTS[item.id];
                      const keys = splitShortcutKeys(combo);
                      return (
                        <Box
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Change shortcut for ${item.label}`}
                          data-testid={`shortcut-row-${item.id}`}
                          onClick={() => {
                            setConflictState(null);
                            setEditingShortcut(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setConflictState(null);
                              setEditingShortcut(item);
                            }
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: 0.75,
                            px: 1.25,
                            borderRadius: 1.5,
                            cursor: 'pointer',
                            border: '1px solid',
                            borderColor: isModified
                              ? 'rgba(245, 158, 11, 0.28)'
                              : 'transparent',
                            bgcolor: isModified
                              ? 'rgba(245, 158, 11, 0.05)'
                              : 'transparent',
                            transition: 'all 0.14s ease',
                            '&:hover': {
                              bgcolor: isModified
                                ? 'rgba(245, 158, 11, 0.10)'
                                : 'rgba(99, 102, 241, 0.08)',
                              borderColor: isModified
                                ? 'rgba(245, 158, 11, 0.45)'
                                : 'rgba(99, 102, 241, 0.25)',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontSize: '0.84rem',
                                color: 'text.primary',
                                fontWeight: isModified ? 600 : 500,
                              }}
                            >
                              {item.label}
                            </Typography>
                            {isModified && (
                              <Tooltip
                                title={`Modified (Default: ${DEFAULT_SHORTCUTS[item.id]})`}
                                arrow
                              >
                                <Box
                                  component="span"
                                  data-testid={`shortcut-modified-${item.id}`}
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.4,
                                    px: 0.75,
                                    py: 0.15,
                                    borderRadius: 1,
                                    bgcolor: 'rgba(245, 158, 11, 0.16)',
                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                    color: '#FBBF24',
                                    fontSize: '0.66rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  <EditOutlined sx={{ fontSize: 12 }} />
                                  Edited
                                </Box>
                              </Tooltip>
                            )}
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            {keys.length > 0 ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {keys.map((key, kIdx) => (
                                  <Box
                                    component="kbd"
                                    key={kIdx}
                                    sx={{
                                      px: 1,
                                      py: 0.28,
                                      minWidth: 28,
                                      textAlign: 'center',
                                      fontFamily: 'monospace',
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                      color: isModified ? '#FDE68A' : '#E2E8F0',
                                      bgcolor: '#161E2E',
                                      border: '1px solid',
                                      borderColor: isModified
                                        ? 'rgba(245, 158, 11, 0.45)'
                                        : 'rgba(148, 163, 184, 0.28)',
                                      borderBottomWidth: '2px',
                                      borderRadius: 1,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                    }}
                                  >
                                    {key}
                                  </Box>
                                ))}
                              </Box>
                            ) : (
                              <Chip
                                size="small"
                                label="Unassigned"
                                sx={{
                                  height: 22,
                                  fontSize: '0.70rem',
                                  fontFamily: 'monospace',
                                  bgcolor: 'rgba(239, 68, 68, 0.12)',
                                  color: '#F87171',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                }}
                              />
                            )}

                            {isModified && (
                              <Tooltip
                                title={`Reset to default (${DEFAULT_SHORTCUTS[item.id]})`}
                                arrow
                              >
                                <IconButton
                                  size="small"
                                  aria-label={`Reset shortcut for ${item.label}`}
                                  data-testid={`reset-shortcut-${item.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetSingleShortcut(item);
                                  }}
                                  sx={{
                                    p: 0.4,
                                    color: '#FBBF24',
                                    bgcolor: 'rgba(245, 158, 11, 0.10)',
                                    '&:hover': {
                                      bgcolor: 'rgba(245, 158, 11, 0.22)',
                                    },
                                  }}
                                >
                                  <RestartAlt sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}

              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <InfoOutlined sx={{ color: '#818CF8', fontSize: 16, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.73rem', color: 'text.secondary' }}>
                  On macOS, you can use <code style={{ color: '#E2E8F0' }}>Cmd</code> in place of{' '}
                  <code style={{ color: '#E2E8F0' }}>Ctrl</code> for all global shortcuts.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Footer / Actions */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: '1px solid rgba(148, 163, 184, 0.12)',
            bgcolor: '#0E131F',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="contained" onClick={onClose} sx={{ px: 3.5, fontWeight: 700 }}>
            Done
          </Button>
        </Box>
      </Box>

      {/* Sub-dialog 1: Capture New Shortcut */}
      {editingShortcut && !conflictState && (
        <Box
          role="dialog"
          aria-label="Change Shortcut"
          aria-modal="true"
          data-testid="shortcut-capture-dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingShortcut(null);
          }}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            p: 2,
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 420,
              bgcolor: '#111827',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 2.5,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.9)',
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <KeyboardOutlined sx={{ color: '#818CF8' }} />
              <Typography variant="h6" fontWeight={700} fontSize="1rem">
                Change Shortcut
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              Press the new key combination for{' '}
              <strong style={{ color: '#F8FAFC' }}>{editingShortcut.label}</strong>:
            </Typography>
            <Box
              sx={{
                py: 2.25,
                px: 2,
                borderRadius: 2,
                bgcolor: 'rgba(7, 10, 16, 0.85)',
                border: '1px dashed rgba(99, 102, 241, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: '#818CF8',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Listening for key combination...
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current:{' '}
                <code style={{ color: '#E2E8F0' }}>
                  {shortcuts[editingShortcut.id] || 'Unassigned'}
                </code>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Button
                size="small"
                color="warning"
                variant="outlined"
                onClick={() => {
                  updateShortcuts({
                    ...shortcuts,
                    [editingShortcut.id]: '',
                  });
                  setEditingShortcut(null);
                }}
              >
                Unbind
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setEditingShortcut(null)}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Sub-dialog 2: Conflict Resolution */}
      {conflictState && (
        <Box
          role="dialog"
          aria-label="Shortcut Conflict"
          aria-modal="true"
          data-testid="shortcut-conflict-dialog"
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1450,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0.76)',
            backdropFilter: 'blur(6px)',
            p: 2,
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 440,
              bgcolor: '#111827',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              borderRadius: 2.5,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.9)',
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <WarningAmberRounded sx={{ color: '#F59E0B' }} />
              <Typography variant="h6" fontWeight={700} fontSize="1rem">
                Shortcut Already Mapped
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
              The shortcut{' '}
              <code
                style={{
                  color: '#FBBF24',
                  fontWeight: 700,
                  background: 'rgba(245, 158, 11, 0.14)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                {conflictState.combo}
              </code>{' '}
              is already assigned to{' '}
              <strong style={{ color: '#F8FAFC' }}>{conflictState.conflictingLabel}</strong>. Do you
              want to cancel or assign it to{' '}
              <strong style={{ color: '#F8FAFC' }}>{conflictState.targetLabel}</strong> and remove
              it from <strong style={{ color: '#F8FAFC' }}>{conflictState.conflictingLabel}</strong>
              ?
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.25 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setConflictState(null);
                  setEditingShortcut(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                color="warning"
                onClick={() => {
                  updateShortcuts({
                    ...shortcuts,
                    [conflictState.conflictingId]: '',
                    [conflictState.targetId]: conflictState.combo,
                  });
                  setConflictState(null);
                  setEditingShortcut(null);
                }}
              >
                Reassign Shortcut
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
