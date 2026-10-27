import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import RestartAlt from '@mui/icons-material/RestartAlt';

export default function UpdateSettings({ updater, running }) {
  const { info, phase, version, currentVersion, error, downloaded, total, check, install } = updater;
  const busy = ['checking', 'downloading', 'installing'].includes(phase);
  const percent = total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : null;
  const status = {
    idle: 'Check for a new version and download it in the background.',
    checking: 'Checking for updates...',
    downloading: `Downloading update${percent === null ? '...' : `: ${percent}%`}`,
    current: 'You are using the latest version.',
    ready: `Version ${version} is ready. Restart SyncForge to install it.`,
    installing: 'Restarting to install the update...',
    error: 'Could not check or download the update. Try again.',
  }[phase];

  return (
    <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2">Installed version: <Box component="span" sx={{ fontFamily: 'monospace' }}>{currentVersion}</Box></Typography>
      {info?.supported ? (
        <>
          <Typography role="status" variant="body2" color="text.secondary">{status}</Typography>
          {busy && <LinearProgress aria-label="Update progress" variant={phase === 'downloading' && percent !== null ? 'determinate' : 'indeterminate'} value={percent || 0} />}
          {error && <Alert severity="error" sx={{ overflowWrap: 'anywhere' }}>{error}</Alert>}
          {phase === 'ready' && running && <Typography variant="body2" color="text.secondary">Wait for the current media task to finish before restarting.</Typography>}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {phase === 'ready' || phase === 'installing' ? (
              <Button variant="contained" startIcon={<RestartAlt />} disabled={running || busy} onClick={install} sx={{ minHeight: 40 }}>
                Restart to install
              </Button>
            ) : (
              <Button variant="outlined" startIcon={<RefreshOutlined />} disabled={busy} onClick={check} sx={{ minHeight: 40 }}>
                {phase === 'error' ? 'Retry update' : 'Check for updates'}
              </Button>
            )}
          </Box>
          {updater.notes && <Box component="details"><Typography component="summary" variant="body2" sx={{ cursor: 'pointer' }}>Release notes</Typography><Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 200, overflowY: 'auto' }}>{updater.notes}</Typography></Box>}
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            {!info ? 'Loading update information...' : info.platform === 'windows'
              ? 'Automatic updates are available in the Windows installer edition. Portable and development builds are updated manually.'
              : 'Automatic updates are currently available in the Windows installer edition. Download new versions from GitHub Releases.'}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <Button component="a" href="https://github.com/itsmrma/SyncForge/releases/latest" target="_blank" rel="noopener noreferrer" variant="outlined" sx={{ minHeight: 40, alignSelf: 'flex-start' }}>Open releases</Button>
        </>
      )}
    </Box>
  );
}
