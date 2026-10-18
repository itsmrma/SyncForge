import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import HistoryIcon from '@mui/icons-material/History';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';

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
  dropZoneLabel,
  recentPaths = [],
  onClearRecentPaths,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [historyAnchor, setHistoryAnchor] = useState(null);

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

  const showEndAdornment = Boolean(value || (recentPaths.length > 0 && !disabled));

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
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
              <InputAdornment position="start" sx={{ mr: 0.75, gap: 0.75 }}>
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
                <Chip
                  size="small"
                  label={dragOver ? 'Release to Drop' : dropZoneLabel || 'Drop Here'}
                  sx={{
                    height: 20,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    bgcolor: dragOver
                      ? 'rgba(56, 189, 248, 0.25)'
                      : 'rgba(99, 102, 241, 0.22)',
                    color: dragOver ? '#38BDF8' : '#A5B4FC',
                    border: '1px solid',
                    borderColor: dragOver
                      ? 'rgba(56, 189, 248, 0.5)'
                      : 'rgba(99, 102, 241, 0.45)',
                  }}
                />
              </InputAdornment>
            ) : null,
            endAdornment: showEndAdornment ? (
              <InputAdornment position="end" sx={{ gap: 0.25 }}>
                {recentPaths.length > 0 && !disabled && (
                  <Tooltip title="Recent paths" arrow>
                    <IconButton
                      size="small"
                      aria-label={`Recent paths for ${label}`}
                      onClick={(e) => setHistoryAnchor(e.currentTarget)}
                      edge="end"
                      sx={{ p: 0.5, color: 'text.secondary' }}
                    >
                      <HistoryIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {value && onShowInFolder && (
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
                {value && !disabled && (
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
      <Menu
        anchorEl={historyAnchor}
        open={Boolean(historyAnchor)}
        onClose={() => setHistoryAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              maxWidth: 440,
              bgcolor: '#0E131F',
              border: '1px solid rgba(148, 163, 184, 0.18)',
            },
          },
        }}
      >
        {recentPaths.map((recent) => {
          const isFile = /\.[a-z0-9]{2,4}$/i.test(recent);
          return (
            <MenuItem
              key={recent}
              onClick={() => {
                onChange(recent);
                setHistoryAnchor(null);
              }}
              sx={{ py: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: '#818CF8' }}>
                {isFile ? (
                  <InsertDriveFileOutlined fontSize="small" />
                ) : (
                  <FolderOpenOutlined fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={recent}
                primaryTypographyProps={{
                  noWrap: true,
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                }}
              />
            </MenuItem>
          );
        })}
        {onClearRecentPaths && (
          <>
            <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.12)' }} />
            <MenuItem
              onClick={() => {
                onClearRecentPaths();
                setHistoryAnchor(null);
              }}
              sx={{ py: 0.6, color: 'text.secondary' }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: 'text.secondary' }}>
                <DeleteSweepOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Clear recent paths"
                primaryTypographyProps={{ fontSize: '0.78rem' }}
              />
            </MenuItem>
          </>
        )}
      </Menu>
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
