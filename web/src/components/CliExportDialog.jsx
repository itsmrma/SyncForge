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
  MenuItem,
} from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import Close from '@mui/icons-material/Close';
import CodeOutlined from '@mui/icons-material/CodeOutlined';

import { buildCliCommandAndScript } from '../cliExport.js';

export default function CliExportDialog({ open, onClose, selectedMod, paths, settings }) {
  const [shell, setShell] = useState(() => /Win/i.test(navigator.platform) ? 'powershell' : 'bash');
  const [yesMode, setYesMode] = useState(true);
  const [keepTracks, setKeepTracks] = useState('');
  const [keepAudio, setKeepAudio] = useState('');
  const [keepSubs, setKeepSubs] = useState('');
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
        shell,
        yes: yesMode,
        keepTracks,
        keepAudio,
        keepSubs,
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
      shell,
      yesMode,
      keepTracks,
      keepAudio,
      keepSubs,
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
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5 }}>
              <TextField
                size="small"
                label="Keep Audio (--keep-audio)"
                placeholder="e.g. jpn or 1"
                value={keepAudio}
                onChange={(e) => setKeepAudio(e.target.value)}
              />
              <TextField
                size="small"
                label="Keep Subtitles (--keep-subs)"
                placeholder="e.g. ita or 10"
                value={keepSubs}
                onChange={(e) => setKeepSubs(e.target.value)}
              />
              <TextField
                size="small"
                label="All Tracks (--keep-tracks)"
                placeholder="e.g. 1,2 or ita,eng"
                value={keepTracks}
                onChange={(e) => setKeepTracks(e.target.value)}
              />
            </Box>
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
                Command Line ({shell === 'powershell' ? 'PowerShell 7.3+' : 'Bash / POSIX sh'})
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              label="Command shell"
              value={shell}
              onChange={(event) => setShell(event.target.value)}
              sx={{ minWidth: 150, ml: 'auto', mr: 1.5 }}
            >
              <MenuItem value="powershell">PowerShell 7.3+</MenuItem>
              <MenuItem value="bash">Bash / POSIX sh</MenuItem>
            </TextField>
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
