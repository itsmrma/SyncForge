import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
} from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import Close from '@mui/icons-material/Close';
import CodeOutlined from '@mui/icons-material/CodeOutlined';

function quoteShellArg(val) {
  const s = String(val ?? '').trim();
  if (!s) return '""';
  if (/^[a-zA-Z0-9_./:\\-]+$/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

function buildCliCommandAndScript(selectedMod, paths, settings, extraOpts = {}) {
  const modId = selectedMod?.id || 'stream_manager';
  const vid = (paths?.video || '').trim() || './input_video';
  const sub = (paths?.sub || '').trim() || './input_source';
  const out = (paths?.output || settings?.default_output_dir || '').trim();

  const nonInteractive = extraOpts.yes ?? true;
  const args = ['syncforge-cli', 'run', modId];
  const scriptObj = {
    module: modId,
    video: vid,
  };

  args.push('-v', quoteShellArg(vid));

  if (selectedMod?.needs?.includes('sub')) {
    args.push('-s', quoteShellArg(sub));
    scriptObj.sub = sub;
  }

  if (selectedMod?.needs?.includes('output') && out) {
    args.push('-o', quoteShellArg(out));
    scriptObj.output = out;
  }

  // Applicable settings per AGENTS.md matrix
  if (['stream_manager', 'injection', 'custom_merge', 'internal_sync'].includes(modId)) {
    const opusMode = settings?.opus_mode || 'off';
    if (opusMode !== 'off') {
      args.push('--opus', opusMode);
      args.push('--opus-bitrate', String(settings?.opus_bitrate || 128));
      if (settings?.opus_downmix === false) {
        args.push('--no-opus-downmix');
      }
      scriptObj.opus_mode = opusMode;
      scriptObj.opus_bitrate = Number(settings?.opus_bitrate || 128);
      scriptObj.opus_downmix = settings?.opus_downmix !== false;
    }
  }

  if (['injection', 'internal_sync'].includes(modId)) {
    if (settings?.auto_audio === false) {
      args.push('--no-auto-audio');
      scriptObj.auto_audio = false;
    }
  }

  if (['sync_subs', 'sync_subs_mkv', 'injection', 'internal_sync'].includes(modId)) {
    if (settings?.auto_subs === false) {
      args.push('--no-auto-subs');
      scriptObj.auto_subs = false;
    }
    if (settings?.enable_max_offset && Number(settings?.max_offset) > 0) {
      args.push('--max-offset', String(settings.max_offset));
      scriptObj.enable_max_offset = true;
      scriptObj.max_offset = Number(settings.max_offset);
    }
  }

  // Module-specific optional flags
  if (modId === 'stream_manager' && extraOpts.keepTracks?.trim()) {
    const kt = extraOpts.keepTracks.trim();
    args.push('--keep-tracks', quoteShellArg(kt));
    scriptObj.keep_tracks = kt;
  }

  if (modId === 'set_default') {
    if (extraOpts.defaultAudio?.trim()) {
      args.push('--default-audio', quoteShellArg(extraOpts.defaultAudio.trim()));
      scriptObj.default_audio = extraOpts.defaultAudio.trim();
    }
    if (extraOpts.defaultSub?.trim()) {
      args.push('--default-sub', quoteShellArg(extraOpts.defaultSub.trim()));
      scriptObj.default_sub = extraOpts.defaultSub.trim();
    }
    if (extraOpts.forcedSub?.trim()) {
      args.push('--forced-sub', quoteShellArg(extraOpts.forcedSub.trim()));
      scriptObj.forced_sub = extraOpts.forcedSub.trim();
    }
  }

  if (modId === 'sync_subs_mkv' && extraOpts.subTrack?.trim()) {
    args.push('--sub-track', quoteShellArg(extraOpts.subTrack.trim()));
    scriptObj.sub_track = extraOpts.subTrack.trim();
  }

  if (modId === 'injection') {
    if (extraOpts.keepTargetAudio) {
      args.push('--keep-target-audio');
      scriptObj.keep_target_audio = true;
    }
    if (extraOpts.keepTargetSubs) {
      args.push('--keep-target-subs');
      scriptObj.keep_target_subs = true;
    }
    if (extraOpts.audioTrack?.trim()) {
      args.push('--import-audio', '--audio-track', quoteShellArg(extraOpts.audioTrack.trim()));
      scriptObj.import_audio = true;
      scriptObj.audio_track = extraOpts.audioTrack.trim();
    }
    if (extraOpts.subTrack?.trim()) {
      args.push('--import-subs', '--sub-track', quoteShellArg(extraOpts.subTrack.trim()));
      scriptObj.import_subs = true;
      scriptObj.sub_track = extraOpts.subTrack.trim();
    }
  }

  if (modId === 'custom_merge') {
    if (extraOpts.keepAAudio?.trim()) {
      args.push('--keep-a-audio', quoteShellArg(extraOpts.keepAAudio.trim()));
      scriptObj.keep_a_audio = extraOpts.keepAAudio.trim();
    }
    if (extraOpts.keepASubs?.trim()) {
      args.push('--keep-a-subs', quoteShellArg(extraOpts.keepASubs.trim()));
      scriptObj.keep_a_subs = extraOpts.keepASubs.trim();
    }
    if (extraOpts.keepBAudio?.trim()) {
      args.push('--keep-b-audio', quoteShellArg(extraOpts.keepBAudio.trim()));
      scriptObj.keep_b_audio = extraOpts.keepBAudio.trim();
    }
    if (extraOpts.keepBSubs?.trim()) {
      args.push('--keep-b-subs', quoteShellArg(extraOpts.keepBSubs.trim()));
      scriptObj.keep_b_subs = extraOpts.keepBSubs.trim();
    }
  }

  if (modId === 'internal_sync') {
    if (extraOpts.refAudioTrack?.trim()) {
      args.push('--ref-audio-track', quoteShellArg(extraOpts.refAudioTrack.trim()));
      scriptObj.ref_audio_track = extraOpts.refAudioTrack.trim();
    }
    if (extraOpts.audioTrack?.trim()) {
      args.push('--sync-audio', '--target-audio-track', quoteShellArg(extraOpts.audioTrack.trim()));
      scriptObj.sync_audio = true;
      scriptObj.target_audio_track = extraOpts.audioTrack.trim();
    }
    if (extraOpts.subTrack?.trim()) {
      args.push('--sync-subs', '--target-sub-track', quoteShellArg(extraOpts.subTrack.trim()));
      scriptObj.sync_subs = true;
      scriptObj.target_sub_track = extraOpts.subTrack.trim();
    }
  }

  if (nonInteractive) {
    args.push('-y');
    scriptObj.yes = true;
  }

  return {
    command: args.join(' '),
    scriptJson: JSON.stringify({ jobs: [scriptObj] }, null, 2),
  };
}

export default function CliExportDialog({ open, onClose, selectedMod, paths, settings }) {
  const [yesMode, setYesMode] = useState(true);
  const [keepTracks, setKeepTracks] = useState('');
  const [defaultAudio, setDefaultAudio] = useState('');
  const [defaultSub, setDefaultSub] = useState('');
  const [forcedSub, setForcedSub] = useState('');
  const [audioTrack, setAudioTrack] = useState('');
  const [subTrack, setSubTrack] = useState('');
  const [refAudioTrack, setRefAudioTrack] = useState('');
  const [keepTargetAudio, setKeepTargetAudio] = useState(true);
  const [keepTargetSubs, setKeepTargetSubs] = useState(true);
  const [keepAAudio, setKeepAAudio] = useState('');
  const [keepASubs, setKeepASubs] = useState('');
  const [keepBAudio, setKeepBAudio] = useState('');
  const [keepBSubs, setKeepBSubs] = useState('');

  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const { command, scriptJson } = useMemo(
    () =>
      buildCliCommandAndScript(selectedMod, paths, settings, {
        yes: yesMode,
        keepTracks,
        defaultAudio,
        defaultSub,
        forcedSub,
        audioTrack,
        subTrack,
        refAudioTrack,
        keepTargetAudio,
        keepTargetSubs,
        keepAAudio,
        keepASubs,
        keepBAudio,
        keepBSubs,
      }),
    [
      selectedMod,
      paths,
      settings,
      yesMode,
      keepTracks,
      defaultAudio,
      defaultSub,
      forcedSub,
      audioTrack,
      subTrack,
      refAudioTrack,
      keepTargetAudio,
      keepTargetSubs,
      keepAAudio,
      keepASubs,
      keepBAudio,
      keepBSubs,
    ]
  );

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(scriptJson);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([scriptJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syncforge-${selectedMod?.id || 'workflow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modId = selectedMod?.id || 'stream_manager';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      data-testid="cli-export-dialog"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            backgroundImage: 'none',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <TerminalIcon sx={{ color: 'primary.main', fontSize: 22 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              CLI Automation & Script Generator
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Run headless workflows with syncforge-cli (no GUI overhead)
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            size="small"
            label={selectedMod?.title || modId}
            sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem' }}
          />
          <IconButton size="small" onClick={onClose} aria-label="Close CLI export dialog">
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Optional non-interactive track & prompt parameters */}
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
              Script Parameters (Optional Track IDs or Language Codes e.g. ita, eng)
            </Typography>
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={yesMode}
                  onChange={(e) => setYesMode(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption" fontWeight={600}>
                  Non-interactive mode (-y / --yes)
                </Typography>
              }
            />
          </Box>

          {modId === 'stream_manager' && (
            <TextField
              size="small"
              label="Tracks to keep (--keep-tracks)"
              placeholder="e.g. 1,2 or ita,eng or all"
              value={keepTracks}
              onChange={(e) => setKeepTracks(e.target.value)}
              fullWidth
            />
          )}

          {modId === 'set_default' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
              <TextField
                size="small"
                label="Default Audio (--default-audio)"
                placeholder="e.g. 1 or ita"
                value={defaultAudio}
                onChange={(e) => setDefaultAudio(e.target.value)}
              />
              <TextField
                size="small"
                label="Default Subtitle (--default-sub)"
                placeholder="e.g. 2 or ita"
                value={defaultSub}
                onChange={(e) => setDefaultSub(e.target.value)}
              />
              <TextField
                size="small"
                label="Forced Subtitle (--forced-sub)"
                placeholder="e.g. 3 or ita"
                value={forcedSub}
                onChange={(e) => setForcedSub(e.target.value)}
              />
            </Box>
          )}

          {modId === 'sync_subs_mkv' && (
            <TextField
              size="small"
              label="Source Subtitle Track (--sub-track)"
              placeholder="e.g. 2 or ita"
              value={subTrack}
              onChange={(e) => setSubTrack(e.target.value)}
              fullWidth
            />
          )}

          {modId === 'injection' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={keepTargetAudio}
                      onChange={(e) => setKeepTargetAudio(e.target.checked)}
                    />
                  }
                  label={<Typography variant="caption">Keep target audio (--keep-target-audio)</Typography>}
                />
                <FormControlLabel
                  sx={{ m: 0 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={keepTargetSubs}
                      onChange={(e) => setKeepTargetSubs(e.target.checked)}
                    />
                  }
                  label={<Typography variant="caption">Keep target subtitles (--keep-target-subs)</Typography>}
                />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <TextField
                  size="small"
                  label="Source Audio Track (--audio-track)"
                  placeholder="e.g. 1 or ita"
                  value={audioTrack}
                  onChange={(e) => setAudioTrack(e.target.value)}
                />
                <TextField
                  size="small"
                  label="Source Subtitle Track (--sub-track)"
                  placeholder="e.g. 2 or ita"
                  value={subTrack}
                  onChange={(e) => setSubTrack(e.target.value)}
                />
              </Box>
            </Box>
          )}

          {modId === 'custom_merge' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                size="small"
                label="Folder A Audio (--keep-a-audio)"
                placeholder="e.g. 1 or jpn or all"
                value={keepAAudio}
                onChange={(e) => setKeepAAudio(e.target.value)}
              />
              <TextField
                size="small"
                label="Folder A Subtitles (--keep-a-subs)"
                placeholder="e.g. 2 or eng or none"
                value={keepASubs}
                onChange={(e) => setKeepASubs(e.target.value)}
              />
              <TextField
                size="small"
                label="Folder B Audio (--keep-b-audio)"
                placeholder="e.g. 1 or ita"
                value={keepBAudio}
                onChange={(e) => setKeepBAudio(e.target.value)}
              />
              <TextField
                size="small"
                label="Folder B Subtitles (--keep-b-subs)"
                placeholder="e.g. 2 or ita"
                value={keepBSubs}
                onChange={(e) => setKeepBSubs(e.target.value)}
              />
            </Box>
          )}

          {modId === 'internal_sync' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
              <TextField
                size="small"
                label="Reference Audio (--ref-audio-track)"
                placeholder="e.g. 1 or jpn"
                value={refAudioTrack}
                onChange={(e) => setRefAudioTrack(e.target.value)}
              />
              <TextField
                size="small"
                label="Target Audio (--target-audio-track)"
                placeholder="e.g. 2 or ita"
                value={audioTrack}
                onChange={(e) => setAudioTrack(e.target.value)}
              />
              <TextField
                size="small"
                label="Target Subtitle (--target-sub-track)"
                placeholder="e.g. 3 or ita"
                value={subTrack}
                onChange={(e) => setSubTrack(e.target.value)}
              />
            </Box>
          )}
        </Box>

        {/* One-line CLI Command */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <TerminalIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
              <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Command Line (Shell / PowerShell / Bash)
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              data-testid="copy-cli-cmd-btn"
              startIcon={copiedCmd ? <CheckOutlined fontSize="small" /> : <ContentCopyOutlined fontSize="small" />}
              onClick={handleCopyCommand}
              sx={{ py: 0.25, px: 1.25, fontSize: '0.75rem' }}
            >
              {copiedCmd ? 'Copied' : 'Copy Command'}
            </Button>
          </Box>
          <Box
            data-testid="cli-command-preview"
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: '#090D16',
              color: '#E2E8F0',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              fontFamily: 'monospace',
              fontSize: '0.80rem',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {command}
          </Box>
        </Box>

        {/* JSON Script File */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CodeOutlined sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                JSON Workflow Script (syncforge-cli script workflow.json)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                data-testid="copy-cli-json-btn"
                startIcon={copiedJson ? <CheckOutlined fontSize="small" /> : <ContentCopyOutlined fontSize="small" />}
                onClick={handleCopyJson}
                sx={{ py: 0.25, px: 1.25, fontSize: '0.75rem' }}
              >
                {copiedJson ? 'Copied' : 'Copy JSON'}
              </Button>
              <Button
                size="small"
                variant="contained"
                data-testid="download-cli-json-btn"
                startIcon={<DownloadOutlined fontSize="small" />}
                onClick={handleDownloadJson}
                sx={{ py: 0.25, px: 1.25, fontSize: '0.75rem' }}
              >
                Download .json
              </Button>
            </Box>
          </Box>
          <Box
            data-testid="cli-json-preview"
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: '#090D16',
              color: '#93C5FD',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              fontFamily: 'monospace',
              fontSize: '0.76rem',
              maxHeight: 200,
              overflowY: 'auto',
              whiteSpace: 'pre',
            }}
          >
            {scriptJson}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.75, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined" size="small">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
