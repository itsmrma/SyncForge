import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  FormControlLabel,
  Checkbox,
  TextField,
  Box,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function SettingsPanel({ selectedMod, settings, onChange, expanded, onToggle }) {
  const modId = selectedMod?.id;
  const isAudioSyncApplicable = modId === 'injection';
  const isSubSyncApplicable = ['injection', 'sync_subs', 'sync_subs_mkv'].includes(modId);
  const isMaxOffsetApplicable = ['injection', 'sync_subs', 'sync_subs_mkv'].includes(modId);

  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      disableGutters
      elevation={0}
      sx={{
        bgcolor: '#131926',
        border: '1px solid rgba(148, 163, 184, 0.14)',
        borderRadius: 2,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ minHeight: 42 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.84rem' }}>
          Settings
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
                  checked={settings.enable_max_offset}
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
              sx={{ width: '100%', mr: 0, mb: isMaxOffsetApplicable ? 0 : 0.5 }}
            />
          </Box>
        </Tooltip>

        <TextField
          label="FFsubsync Max Offset (s)"
          type="number"
          size="small"
          fullWidth
          disabled={!isMaxOffsetApplicable || !settings.enable_max_offset}
          value={settings.max_offset}
          onChange={(e) => onChange({ ...settings, max_offset: e.target.value })}
          sx={{ mb: 1, mt: 0.5 }}
        />

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
                  checked={settings.auto_audio}
                  onChange={(e) => onChange({ ...settings, auto_audio: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography fontSize="0.82rem">Auto-sync Audio</Typography>
                  {!isAudioSyncApplicable && (
                    <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.70rem', lineHeight: 1.2 }}>
                      Not used in this module (WaveSync Injection only)
                    </Typography>
                  )}
                </Box>
              }
              sx={{ width: '100%', mr: 0, mb: isAudioSyncApplicable ? 0 : 0.5 }}
            />
          </Box>
        </Tooltip>

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
                  checked={settings.auto_subs}
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
              sx={{ width: '100%', mr: 0, mb: isSubSyncApplicable ? 0 : 0.5 }}
            />
          </Box>
        </Tooltip>

        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={settings.notify_on_finish}
              onChange={(e) => onChange({ ...settings, notify_on_finish: e.target.checked })}
            />
          }
          label={<Typography fontSize="0.82rem">Notify when task finishes</Typography>}
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
          label={<Typography fontSize="0.82rem">Play sound on completion</Typography>}
          sx={{ width: '100%', mr: 0 }}
        />
      </AccordionDetails>
    </Accordion>
  );
}
