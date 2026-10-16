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
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';

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
  helperText,
  isWindowDragging = false,
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
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
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
        p: '4px',
        borderRadius: 2,
        border: '1.5px dashed',
        borderColor: dragOver
          ? '#38BDF8'
          : isWindowDragging
            ? 'rgba(99, 102, 241, 0.7)'
            : 'transparent',
        bgcolor: dragOver
          ? 'rgba(56, 189, 248, 0.12)'
          : isWindowDragging
            ? 'rgba(99, 102, 241, 0.05)'
            : 'transparent',
        transform: dragOver ? 'scale(1.015)' : 'none',
        boxShadow: dragOver
          ? '0 0 0 2px rgba(56, 189, 248, 0.4), 0 0 24px rgba(56, 189, 248, 0.35)'
          : isWindowDragging
            ? '0 0 14px rgba(99, 102, 241, 0.25)'
            : 'none',
        animation: isWindowDragging && !dragOver ? 'dropPulse 1.8s ease-in-out infinite' : 'none',
        '@keyframes dropPulse': {
          '0%': {
            borderColor: 'rgba(99, 102, 241, 0.4)',
            boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.15), 0 0 8px rgba(99, 102, 241, 0.12)',
          },
          '50%': {
            borderColor: 'rgba(56, 189, 248, 0.85)',
            boxShadow: '0 0 0 2px rgba(56, 189, 248, 0.35), 0 0 18px rgba(56, 189, 248, 0.28)',
          },
          '100%': {
            borderColor: 'rgba(99, 102, 241, 0.4)',
            boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.15), 0 0 8px rgba(99, 102, 241, 0.12)',
          },
        },
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <TextField
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        fullWidth
        size="small"
        disabled={disabled}
        placeholder={isWindowDragging && !value ? 'Drop file or folder here...' : placeholder}
        helperText={helperText}
        sx={{
          '& .MuiOutlinedInput-root': {
            transition: 'all 0.2s ease',
            ...(isWindowDragging && {
              '& fieldset': {
                borderColor: dragOver ? '#38BDF8 !important' : 'rgba(99, 102, 241, 0.7)',
                borderStyle: dragOver ? 'solid' : 'dashed',
                borderWidth: dragOver ? '2px !important' : '1.5px',
              },
            }),
          },
        }}
        slotProps={{
          input: {
            startAdornment: isWindowDragging ? (
              <InputAdornment position="start" sx={{ mr: 0.5 }}>
                <FileDownloadOutlined
                  sx={{
                    fontSize: 20,
                    color: dragOver ? '#38BDF8' : '#818CF8',
                    animation: 'dropBounce 0.8s ease-in-out infinite alternate',
                    '@keyframes dropBounce': {
                      '0%': { transform: 'translateY(-2px)' },
                      '100%': { transform: 'translateY(2px)' },
                    },
                  }}
                />
              </InputAdornment>
            ) : null,
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
