import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from '@mui/material';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

export default function PathInput({
  label,
  value,
  onChange,
  onPick,
  onShowInFolder,
  onDragHoverChange,
  mediaType,
  disabled,
  placeholder,
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (event) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (!dragOver) {
      setDragOver(true);
      onDragHoverChange?.(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    onDragHoverChange?.(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    onDragHoverChange?.(false);
    if (disabled) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const dropped = files[0];
      const droppedPath = dropped.path || dropped.name;
      if (droppedPath) {
        onChange(droppedPath);
        return;
      }
    }
    const textData = event.dataTransfer?.getData('text/plain');
    if (textData && textData.trim()) {
      onChange(textData.trim());
    }
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        borderRadius: 1.5,
        transition: 'box-shadow 0.15s ease, background-color 0.15s ease',
        ...(dragOver && {
          boxShadow: '0 0 0 2px #6366F1',
          bgcolor: 'rgba(99, 102, 241, 0.08)',
        }),
      }}
    >
      <TextField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        fullWidth
        size="small"
        disabled={disabled}
        placeholder={placeholder}
        slotProps={{
          input: {
            endAdornment: value ? (
              <InputAdornment position="end" sx={{ gap: 0.25 }}>
                {onShowInFolder && (
                  <Tooltip title="Show in Explorer / Finder" arrow>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={`Open folder for ${label}`}
                        onClick={() => onShowInFolder(value)}
                        edge="end"
                        sx={{ p: 0.5, color: 'text.secondary' }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
                {!disabled && (
                  <Tooltip title="Clear path" arrow>
                    <IconButton
                      size="small"
                      aria-label={`Clear ${label}`}
                      onClick={() => onChange('')}
                      edge="end"
                      sx={{ p: 0.5, color: 'text.secondary' }}
                    >
                      <ClearIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </InputAdornment>
            ) : null,
          },
        }}
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
