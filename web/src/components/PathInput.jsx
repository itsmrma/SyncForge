import { Box, Button, TextField } from '@mui/material';

export default function PathInput({ label, value, onChange, onPick, mediaType, disabled, placeholder }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <TextField label={label} value={value} onChange={event => onChange(event.target.value)}
        fullWidth size="small" disabled={disabled} placeholder={placeholder} />
      {mediaType && <Button variant="outlined" disabled={disabled}
        aria-label={`Select file for ${label}`} onClick={() => onPick('file', mediaType)}>File</Button>}
      <Button variant="outlined" disabled={disabled}
        aria-label={`Select folder for ${label}`} onClick={() => onPick('folder')}>Folder</Button>
    </Box>
  );
}
