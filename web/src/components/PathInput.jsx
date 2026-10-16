import { Box, Button, TextField } from '@mui/material';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';

export default function PathInput({
  label,
  value,
  onChange,
  onPick,
  mediaType,
  disabled,
  placeholder,
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        fullWidth
        size="small"
        disabled={disabled}
        placeholder={placeholder}
      />
      {mediaType && (
        <Button
          variant="outlined"
          disabled={disabled}
          startIcon={<InsertDriveFileOutlined fontSize="small" />}
          aria-label={`Select file for ${label}`}
          onClick={() => onPick('file', mediaType)}
          sx={{ flexShrink: 0, height: 40, px: 1.75 }}
        >
          File
        </Button>
      )}
      <Button
        variant="outlined"
        disabled={disabled}
        startIcon={<FolderOpenOutlined fontSize="small" />}
        aria-label={`Select folder for ${label}`}
        onClick={() => onPick('folder')}
        sx={{ flexShrink: 0, height: 40, px: 1.75 }}
      >
        Folder
      </Button>
    </Box>
  );
}
