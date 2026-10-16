import { useEffect } from 'react';
import {
  Typography,
  FormControlLabel,
  Checkbox,
  TextField,
  MenuItem,
  Box,
  Button,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import Settings from '@mui/icons-material/Settings';
import Close from '@mui/icons-material/Close';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import { desktopBridge } from '../bridge';

export default function SettingsDialog({
  open,
  onClose,
  selectedMod,
  settings,
  onChange,
}) {
  const modId = selectedMod?.id;
  const isAudioSyncApplicable = modId === 'injection';
  const isSubSyncApplicable = ['injection', 'sync_subs', 'sync_subs_mkv'].includes(modId);
  const isMaxOffsetApplicable = ['injection', 'sync_subs', 'sync_subs_mkv'].includes(modId);
  const isOpusApplicable = ['stream_manager', 'injection', 'custom_merge'].includes(modId);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 580,
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
        {/* Title */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
            bgcolor: 'rgba(255, 255, 255, 0.01)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 2,
                bgcolor: 'rgba(99, 102, 241, 0.16)',
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
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                Global preferences and module transcoding rules
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

        {/* Content */}
        <Box sx={{ p: 3, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Section 1: Audio & Transcoding */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <HeadphonesOutlined sx={{ color: '#34D399', fontSize: 18 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#34D399', fontSize: '0.82rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Audio & Transcoding
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 0.5 }}>
            {/* Opus Audio Conversion */}
            <Tooltip
              title={!isOpusApplicable ? 'Opus conversion only applies to audio muxing modules (Stream Manager, WaveSync Injection, Custom Merge).' : ''}
              placement="top-start"
              arrow
            >
              <Box>
                <TextField
                  select
                  size="small"
                  fullWidth
                  disabled={!isOpusApplicable}
                  label="Opus Audio Encoding (128 kbps stereo)"
                  value={settings.opus_mode || 'off'}
                  onChange={(e) => onChange({ ...settings, opus_mode: e.target.value })}
                  helperText={
                    !isOpusApplicable
                      ? 'Not used in this module (Stream Manager, Injection, and Custom Merge only)'
                      : 'Re-encode kept and merged audio tracks to stereo Opus 128k to save space'
                  }
                  sx={{
                    '& .MuiFormHelperText-root': {
                      color: !isOpusApplicable ? 'text.disabled' : 'text.secondary',
                      fontSize: '0.70rem',
                    },
                  }}
                >
                  <MenuItem value="off">Disabled (Keep original audio lossless)</MenuItem>
                  <MenuItem value="prompt">Ask per batch (Interactive prompt with preview)</MenuItem>
                  <MenuItem value="always">Always convert (Opus 128k stereo)</MenuItem>
                </TextField>
              </Box>
            </Tooltip>

            {/* Auto-sync Audio */}
            <Tooltip
              title={!isAudioSyncApplicable ? 'Auto-sync Audio is only supported in WaveSync Injection.' : ''}
              placement="top-start"
              arrow
            >
              <Box component="span" sx={{ display: 'block' }}>
                <FormControlLabel
                  disabled={!isAudioSyncApplicable}
                  control={
                    <Checkbox
                      size="small"
                      checked={Boolean(settings.auto_audio ?? true)}
                      onChange={(e) => onChange({ ...settings, auto_audio: e.target.checked })}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography fontSize="0.82rem">Auto-sync Audio</Typography>
                      {!isAudioSyncApplicable ? (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.70rem', lineHeight: 1.2 }}>
                          Not used in this module (WaveSync Injection only)
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.70rem', lineHeight: 1.2 }}>
                          Waveform cross-correlation delay calculation
                        </Typography>
                      )}
                    </Box>
                  }
                  sx={{ width: '100%', mr: 0 }}
                />
              </Box>
            </Tooltip>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.10)' }} />

        {/* Section 2: Subtitles & Timing */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <SubtitlesOutlined sx={{ color: '#38BDF8', fontSize: 18 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#38BDF8', fontSize: '0.82rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Subtitles & Synchronization
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pl: 0.5 }}>
            {/* Auto-sync Subs */}
            <Tooltip
              title={!isSubSyncApplicable ? 'Auto-sync Subs only applies to subtitle synchronization modules.' : ''}
              placement="top-start"
              arrow
            >
              <Box component="span" sx={{ display: 'block' }}>
                <FormControlLabel
                  disabled={!isSubSyncApplicable}
                  control={
                    <Checkbox
                      size="small"
                      checked={Boolean(settings.auto_subs ?? true)}
                      onChange={(e) => onChange({ ...settings, auto_subs: e.target.checked })}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography fontSize="0.82rem">Auto-sync Subs</Typography>
                      {!isSubSyncApplicable && (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.70rem', lineHeight: 1.2 }}>
                          Not used in this module (Subtitle sync only)
                        </Typography>
                      )}
                    </Box>
                  }
                  sx={{ width: '100%', mr: 0 }}
                />
              </Box>
            </Tooltip>

            {/* Enable Max Offset */}
            <Tooltip
              title={!isMaxOffsetApplicable ? 'Max Offset limit only applies to subtitle synchronization modules (FFsubsync).' : ''}
              placement="top-start"
              arrow
            >
              <Box component="span" sx={{ display: 'block' }}>
                <FormControlLabel
                  disabled={!isMaxOffsetApplicable}
                  control={
                    <Checkbox
                      size="small"
                      checked={Boolean(settings.enable_max_offset)}
                      onChange={(e) => onChange({ ...settings, enable_max_offset: e.target.checked })}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography fontSize="0.82rem">Enable Max Offset limit</Typography>
                      {!isMaxOffsetApplicable && (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.70rem', lineHeight: 1.2 }}>
                          Not used in this module (Subtitle sync only)
                        </Typography>
                      )}
                    </Box>
                  }
                  sx={{ width: '100%', mr: 0 }}
                />
              </Box>
            </Tooltip>

            {/* Max Offset Input */}
            <TextField
              label="FFsubsync Max Offset (seconds)"
              type="number"
              size="small"
              fullWidth
              disabled={!isMaxOffsetApplicable || !settings.enable_max_offset}
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
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#F59E0B', fontSize: '0.82rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Default Output Directory
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                size="small"
                fullWidth
                label="Default Output Folder"
                value={settings.default_output_dir || ''}
                placeholder="Defaults to source folder if empty"
                onChange={(e) => onChange({ ...settings, default_output_dir: e.target.value })}
                helperText={
                  settings.default_output_dir
                    ? 'All processed files will default to this folder'
                    : 'If not configured, output files default to the source video folder'
                }
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
              {settings.default_output_dir && (
                <Tooltip title="Clear default output folder">
                  <IconButton
                    size="small"
                    onClick={handleClearDefaultOutputDir}
                    sx={{ p: 1, color: 'text.secondary' }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.10)' }} />

        {/* Section 4: Notifications & Feedback */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <NotificationsActiveOutlined sx={{ color: '#A855F7', fontSize: 18 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#A855F7', fontSize: '0.82rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Notifications & Sound
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, pl: 0.5 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={Boolean(settings.notify_on_finish ?? true)}
                  onChange={(e) => onChange({ ...settings, notify_on_finish: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography fontSize="0.82rem">Notify when task finishes</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.70rem' }}>
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
                  onChange={(e) => onChange({ ...settings, sound_on_finish: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography fontSize="0.82rem">Play sound on completion</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.70rem' }}>
                    Plays a gentle chime on success or alert sound on error
                  </Typography>
                </Box>
              }
              sx={{ width: '100%', mr: 0 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Footer / Actions */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderTop: '1px solid rgba(148, 163, 184, 0.12)',
          bgcolor: 'rgba(255, 255, 255, 0.01)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          variant="contained"
          onClick={onClose}
          sx={{ px: 3.5, fontWeight: 700 }}
        >
          Done
        </Button>
      </Box>
    </Box>
  </Box>
  );
}
