import { Accordion, AccordionSummary, AccordionDetails, Typography, FormControlLabel, Checkbox, TextField } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function SettingsPanel({ settings, onChange, expanded, onToggle }) {
  return (
    <Accordion expanded={expanded} onChange={onToggle} disableGutters elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">Settings</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, display: 'flex', flexDirection: 'column' }}>
        <FormControlLabel
          control={<Checkbox checked={settings.enable_max_offset} onChange={e => onChange({...settings, enable_max_offset: e.target.checked})} />}
          label={<Typography fontSize="0.85rem">Enable Max Offset limit</Typography>}
        />
        <TextField
          label="FFsubsync Max Offset (s)"
          type="number"
          size="small"
          fullWidth
          disabled={!settings.enable_max_offset}
          value={settings.max_offset}
          onChange={e => onChange({...settings, max_offset: e.target.value})}
          sx={{ mb: 2, mt: 1 }}
        />
        <FormControlLabel
          control={<Checkbox checked={settings.auto_audio} onChange={e => onChange({...settings, auto_audio: e.target.checked})} />}
          label={<Typography fontSize="0.85rem">Auto-sync Audio</Typography>}
        />
        <FormControlLabel
          control={<Checkbox checked={settings.auto_subs} onChange={e => onChange({...settings, auto_subs: e.target.checked})} />}
          label={<Typography fontSize="0.85rem">Auto-sync Subs</Typography>}
        />
        <FormControlLabel
          control={<Checkbox checked={settings.notify_on_finish} onChange={e => onChange({...settings, notify_on_finish: e.target.checked})} />}
          label={<Typography fontSize="0.85rem">Notify when task finishes</Typography>}
        />
      </AccordionDetails>
    </Accordion>
  );
}
