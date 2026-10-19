import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import RestartAlt from '@mui/icons-material/RestartAlt';
import Close from '@mui/icons-material/Close';
import { desktopBridge } from '../bridge';

function parsePreviewContext(request) {
  if (!request) return {};
  if (typeof request.context === 'string' && request.context.trim().startsWith('{')) {
    try {
      return JSON.parse(request.context);
    } catch {
      // ignore invalid JSON context
    }
  }
  if (request.context && typeof request.context === 'object') {
    return request.context;
  }
  return request;
}

function formatSignedMs(ms) {
  const num = Number(ms) || 0;
  return `${num >= 0 ? `+${num}` : num} ms`;
}

export default function SyncPreviewDialog({ request, onResolve, onStop, stopping }) {
  const meta = useMemo(() => parsePreviewContext(request), [request]);

  const filename =
    meta.filename ||
    meta.file_name ||
    (meta.target ? meta.target.split(/[/\\]/).pop() : '') ||
    (meta.target_video ? meta.target_video.split(/[/\\]/).pop() : '') ||
    'Media Stream';
  const target = meta.target || meta.target_video || request?.files?.[0] || '';
  const audioFile = meta.audio_file ?? meta.audioFile ?? null;
  const subFile = meta.sub_file ?? meta.subFile ?? null;
  const hasAudio = Boolean(meta.has_audio ?? audioFile !== null);
  const hasSub = Boolean(meta.has_sub ?? subFile !== null);

  const [audioDelay, setAudioDelay] = useState(() => Number(meta.audio_delay_ms ?? meta.audioDelayMs ?? 0) || 0);
  const [subDelay, setSubDelay] = useState(() => Number(meta.sub_delay_ms ?? meta.subDelayMs ?? 0) || 0);
  const [startTime, setStartTime] = useState(() => meta.start_time || meta.startTime || '00:05:00');
  const [duration] = useState(() => meta.duration || '00:02:00');
  const [mpvStatus, setMpvStatus] = useState(null);
  const [launchingMpv, setLaunchingMpv] = useState(false);

  const handleLaunchMpv = async () => {
    setLaunchingMpv(true);
    setMpvStatus(null);
    try {
      await desktopBridge.previewSyncMpv({
        target,
        audioFile: hasAudio ? audioFile : null,
        audioDelayMs: audioDelay,
        subFile: hasSub ? subFile : null,
        subDelayMs: subDelay,
        startTime,
      });
      setMpvStatus({
        severity: 'info',
        text: `mpv preview launched at ${startTime} (Audio: ${formatSignedMs(audioDelay)}, Sub: ${formatSignedMs(subDelay)})`,
      });
    } catch (err) {
      setMpvStatus({
        severity: 'error',
        text: err?.message || String(err),
      });
    } finally {
      setLaunchingMpv(false);
    }
  };

  const handleConfirm = () => {
    onResolve(
      JSON.stringify({
        action: 'confirm',
        audio_delay_ms: Number(audioDelay) || 0,
        sub_delay_ms: Number(subDelay) || 0,
      })
    );
  };

  const handleRecalculate = () => {
    onResolve(
      JSON.stringify({
        action: 'recalculate',
        start_time: startTime.trim() || '00:05:00',
        duration,
      })
    );
  };

  const handleCancel = () => {
    onResolve(
      JSON.stringify({
        action: 'cancel',
      })
    );
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (stopping) return;
      const tag = event.target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea';
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCancel();
      } else if (event.key === 'Enter' && !isInput) {
        event.preventDefault();
        handleConfirm();
      } else if (event.key === ' ' && !isInput && tag !== 'button') {
        event.preventDefault();
        handleLaunchMpv();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const highConfidenceAudio = Math.abs(audioDelay) <= 5000;

  return (
    <Dialog
      open
      maxWidth="sm"
      fullWidth
      aria-labelledby="sync-preview-dialog-title"
      data-testid="sync-preview-dialog"
      onClose={() => {
        if (!stopping) handleCancel();
      }}
    >
      <DialogTitle
        id="sync-preview-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          pb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 1.75,
              bgcolor: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.32)',
              color: 'secondary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TuneOutlined fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              Synchronization Preview & Micro-Nudge
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              Audition calculated offsets in mpv or fine-tune before atomic remuxing
            </Typography>
          </Box>
        </Box>
        <Chip
          size="small"
          label={filename}
          data-testid="sync-preview-filename"
          sx={{
            maxWidth: 200,
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
            fontSize: '0.72rem',
            fontWeight: 700,
            bgcolor: 'rgba(99, 102, 241, 0.14)',
            color: 'primary.main',
            border: '1px solid rgba(99, 102, 241, 0.30)',
          }}
        />
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 2.25 }}>
        {/* Monospace Readout Banner */}
        <Box
          sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1.5,
            p: 1.75,
            borderRadius: 2,
            bgcolor: theme.palette.mode === 'light' ? '#E8ECF2' : '#0B0F18',
            border: '1px solid',
            borderColor: 'divider',
          })}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <HeadphonesOutlined
                sx={{
                  fontSize: 16,
                  color: highConfidenceAudio ? 'success.main' : 'warning.main',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'text.secondary',
                }}
              >
                Audio Delay
              </Typography>
            </Box>
            <Typography
              data-testid="sync-preview-audio-readout"
              sx={{
                fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
                fontVariantNumeric: 'tabular-nums',
                fontSize: '1.15rem',
                fontWeight: 800,
                color: highConfidenceAudio ? 'success.main' : 'warning.main',
              }}
            >
              {`Audio Delay: ${formatSignedMs(audioDelay)}`}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {`Sample window: ${startTime} (${duration})`}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <SubtitlesOutlined sx={{ fontSize: 16, color: 'secondary.main' }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'text.secondary',
                }}
              >
                Subtitle Offset
              </Typography>
            </Box>
            <Typography
              data-testid="sync-preview-sub-readout"
              sx={{
                fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
                fontVariantNumeric: 'tabular-nums',
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'secondary.main',
              }}
            >
              {`Subtitle Offset: ${formatSignedMs(subDelay)}`}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {hasSub ? 'Aligned stream ready' : 'Manual subtitle offset'}
            </Typography>
          </Box>
        </Box>

        {/* Launch mpv Preview CTA */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PlayArrow />}
            disabled={launchingMpv || stopping}
            onClick={handleLaunchMpv}
            data-testid="preview-in-mpv-btn"
            sx={{ fontWeight: 700, px: 2.5 }}
          >
            {launchingMpv ? 'Launching mpv...' : 'Preview in mpv'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            Hotkeys in mpv: [ / ] audio delay, z / Z subtitle delay
          </Typography>
        </Box>

        {mpvStatus && (
          <Alert severity={mpvStatus.severity} sx={{ py: 0.25 }}>
            {mpvStatus.text}
          </Alert>
        )}

        {/* Audio Micro-Nudge Controls */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Audio Offset Micro-Nudge (--audio-delay)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {[-50, -10, 10, 50].map((delta) => {
              const label = `${delta > 0 ? `+${delta}` : delta}ms`;
              return (
                <Button
                  key={delta}
                  size="small"
                  variant="outlined"
                  data-testid={`nudge-audio-${delta > 0 ? `+${delta}` : delta}`}
                  onClick={() => setAudioDelay((prev) => (Number(prev) || 0) + delta)}
                  sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 68 }}
                >
                  {label}
                </Button>
              );
            })}
            <TextField
              size="small"
              type="number"
              label="Audio Delay (ms)"
              value={audioDelay}
              onChange={(e) => setAudioDelay(Number(e.target.value) || 0)}
              sx={{ width: 150, ml: 'auto' }}
              slotProps={{
                htmlInput: {
                  'aria-label': 'Audio Delay (ms)',
                  style: { fontFamily: 'monospace' },
                },
              }}
            />
          </Box>
        </Box>

        {/* Subtitle Micro-Nudge Controls */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Subtitle Offset Micro-Nudge (--sub-delay)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {[-100, -25, 25, 100].map((delta) => {
              const label = `${delta > 0 ? `+${delta}` : delta}ms`;
              return (
                <Button
                  key={delta}
                  size="small"
                  variant="outlined"
                  data-testid={`nudge-sub-${delta > 0 ? `+${delta}` : delta}`}
                  onClick={() => setSubDelay((prev) => (Number(prev) || 0) + delta)}
                  sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 68 }}
                >
                  {label}
                </Button>
              );
            })}
            <TextField
              size="small"
              type="number"
              label="Subtitle Offset (ms)"
              value={subDelay}
              onChange={(e) => setSubDelay(Number(e.target.value) || 0)}
              sx={{ width: 150, ml: 'auto' }}
              slotProps={{
                htmlInput: {
                  'aria-label': 'Subtitle Offset (ms)',
                  style: { fontFamily: 'monospace' },
                },
              }}
            />
          </Box>
        </Box>

        {/* Recalculate Sample Window */}
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Sample Window Start"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            sx={{ width: 165 }}
            slotProps={{
              htmlInput: {
                'aria-label': 'Sample Window Start',
                style: { fontFamily: 'monospace' },
              },
            }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAlt fontSize="small" />}
            disabled={stopping}
            onClick={handleRecalculate}
            data-testid="recalculate-window-btn"
          >
            Recalculate with different window
          </Button>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.25, pt: 1, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Close fontSize="small" />}
          disabled={stopping}
          onClick={onStop || handleCancel}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<CheckCircleOutlined fontSize="small" />}
          disabled={stopping}
          onClick={handleConfirm}
          data-testid="confirm-and-mux-btn"
          sx={{ fontWeight: 700, px: 2.5 }}
        >
          Confirm & Mux
        </Button>
      </DialogActions>
    </Dialog>
  );
}
