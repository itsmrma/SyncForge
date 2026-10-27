import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Dialog,
  Typography,
  FormControlLabel,
  Checkbox,
  TextField,
  MenuItem,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Tooltip,
  Chip,
  Collapse,
} from '@mui/material';
import Settings from '@mui/icons-material/Settings';
import Close from '@mui/icons-material/Close';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import RestartAlt from '@mui/icons-material/RestartAlt';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import PlayArrow from '@mui/icons-material/PlayArrow';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlined from '@mui/icons-material/SettingsBrightnessOutlined';
import KeyOutlined from '@mui/icons-material/KeyOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import UnfoldMoreOutlined from '@mui/icons-material/UnfoldMoreOutlined';
import UnfoldLessOutlined from '@mui/icons-material/UnfoldLessOutlined';
import SystemUpdateAltOutlined from '@mui/icons-material/SystemUpdateAltOutlined';
import UpdateSettings from './UpdateSettings';
import { desktopBridge } from '../bridge';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_GROUPS,
  ALL_SHORTCUT_ITEMS,
  formatEventToShortcut,
  splitShortcutKeys,
  formatShortcutDisplay,
} from '../shortcuts';

function SectionCard({
  icon: IconComponent,
  title,
  tag,
  iconColor = 'primary.main',
  children,
  testId,
  headerAction,
  expanded = true,
  onToggle,
}) {
  return (
    <Box
      data-testid={testId}
      sx={(theme) => ({
        flexShrink: 0,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor:
          theme.palette.mode === 'light'
            ? '#FFFFFF'
            : '#111622',
        overflow: 'hidden',
        boxShadow:
          theme.palette.mode === 'light'
            ? '0 1px 3px rgba(15, 23, 42, 0.05)'
            : '0 2px 6px rgba(0, 0, 0, 0.35)',
        transition: 'border-color 0.15s ease',
        '&:hover': {
          borderColor:
            theme.palette.mode === 'light'
              ? 'rgba(99, 102, 241, 0.35)'
              : 'rgba(99, 102, 241, 0.30)',
        },
      })}
    >
      <Box
        role={onToggle ? 'button' : undefined}
        tabIndex={onToggle ? 0 : undefined}
        aria-expanded={onToggle ? expanded : undefined}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (onToggle && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onToggle();
          }
        }}
        sx={(theme) => ({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.2,
          cursor: onToggle ? 'pointer' : 'default',
          userSelect: 'none',
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          bgcolor:
            theme.palette.mode === 'light'
              ? '#F4F6F9'
              : '#0B0F18',
          transition: 'background-color 0.15s ease',
          '&:hover': onToggle
            ? {
                bgcolor:
                  theme.palette.mode === 'light'
                    ? '#ECEFF4'
                    : '#0E1320',
              }
            : {},
        })}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          {IconComponent && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 1.5,
                bgcolor: (theme) =>
                  theme.palette.mode === 'light'
                    ? 'rgba(15, 23, 42, 0.05)'
                    : 'rgba(255, 255, 255, 0.05)',
                color: iconColor,
              }}
            >
              <IconComponent sx={{ fontSize: 16 }} />
            </Box>
          )}
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{
              fontSize: '0.84rem',
              letterSpacing: '-0.01em',
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>
        </Box>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          onClick={(e) => {
            if (e.target.closest('a, button')) {
              e.stopPropagation();
            }
          }}
        >
          {tag && (
            <Chip
              size="small"
              label={tag}
              sx={{
                height: 20,
                fontSize: '0.66rem',
                fontWeight: 700,
                bgcolor: 'action.hover',
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          )}
          {headerAction}
          {onToggle && (
            <Box
              aria-hidden="true"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 0.25,
                color: 'text.secondary',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <KeyboardArrowDown sx={{ fontSize: 18 }} />
            </Box>
          )}
        </Box>
      </Box>
      <Collapse in={expanded} timeout="auto" unmountOnExit={false}>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function SettingToggleRow({
  title,
  description,
  icon: RowIcon,
  checked,
  onChange,
  disabled = false,
  divider = false,
}) {
  return (
    <Box
      sx={(theme) => ({
        borderBottom: divider ? '1px solid' : 'none',
        borderColor: 'divider',
        transition: 'background-color 0.1s ease',
        userSelect: 'none',
        '&:hover': {
          bgcolor: disabled
            ? 'transparent'
            : theme.palette.mode === 'light'
            ? 'rgba(15, 23, 42, 0.03)'
            : 'rgba(255, 255, 255, 0.03)',
        },
        '&:active': {
          bgcolor: disabled
            ? 'transparent'
            : theme.palette.mode === 'light'
            ? 'rgba(15, 23, 42, 0.06)'
            : 'rgba(255, 255, 255, 0.06)',
        },
      })}
    >
      <FormControlLabel
        labelPlacement="start"
        disabled={disabled}
        control={
          <Checkbox
            size="small"
            checked={Boolean(checked)}
            onChange={(e) => {
              if (!disabled && onChange) {
                onChange(e.target.checked);
              }
            }}
            disabled={disabled}
            sx={{
              p: 0.75,
              color: 'text.secondary',
              '&.Mui-checked': {
                color: 'primary.main',
              },
            }}
          />
        }
        label={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pr: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {RowIcon && <RowIcon sx={{ fontSize: 16, color: 'secondary.main' }} />}
              <Typography
                sx={{
                  fontSize: '0.83rem',
                  fontWeight: 600,
                  color: disabled ? 'text.disabled' : 'text.primary',
                  lineHeight: 1.3,
                }}
              >
                {title}
              </Typography>
            </Box>
            {description && (
              <Typography
                variant="caption"
                sx={{
                  color: disabled ? 'text.disabled' : 'text.secondary',
                  fontSize: '0.71rem',
                  lineHeight: 1.35,
                }}
              >
                {description}
              </Typography>
            )}
          </Box>
        }
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          m: 0,
          px: 2.25,
          py: 1.25,
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      />
    </Box>
  );
}

export default function SettingsDialog({
  open,
  onClose,
  _selectedMod,
  settings,
  onChange,
  shortcuts = DEFAULT_SHORTCUTS,
  onShortcutsChange,
  initialTab = 'general',
  updater,
  running = false,
}) {
  const [activeTab, setActiveTab] = useState(initialTab === 'updates' ? 'general' : initialTab || 'general');
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  const [editingShortcut, setEditingShortcut] = useState(null);
  const [conflictState, setConflictState] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const [shortcutFilter, setShortcutFilter] = useState('');
  const scrollRef = useRef(null);

  const [expandedSections, setExpandedSections] = useState({
    appearance: true,
    audio: true,
    subtitles: true,
    opensubtitles: true,
    output: true,
    notifications: true,
    portable: true,
    updates: true,
  });

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allGeneralExpanded = useMemo(() => {
    return Object.values(expandedSections).every(Boolean);
  }, [expandedSections]);

  const toggleAllGeneral = () => {
    const nextVal = !allGeneralExpanded;
    setExpandedSections({
      appearance: nextVal,
      audio: nextVal,
      subtitles: nextVal,
      opensubtitles: nextVal,
      output: nextVal,
      notifications: nextVal,
      portable: nextVal,
      updates: nextVal,
    });
  };

  const [expandedShortcutGroups, setExpandedShortcutGroups] = useState({
    'Task Execution & Merging': true,
    'Workspace & Diagnostics': true,
    'Quick Module Switching': true,
  });

  const toggleShortcutGroup = (cat) => {
    setExpandedShortcutGroups((prev) => ({
      ...prev,
      [cat]: prev[cat] === undefined ? false : !prev[cat],
    }));
  };

  const allShortcutsExpanded = useMemo(() => {
    return Object.values(expandedShortcutGroups).every(Boolean);
  }, [expandedShortcutGroups]);

  const toggleAllShortcuts = () => {
    const nextVal = !allShortcutsExpanded;
    const next = {};
    SHORTCUT_GROUPS.forEach((g) => {
      next[g.category] = nextVal;
    });
    setExpandedShortcutGroups(next);
  };

  const [toolsStatus, setToolsStatus] = useState(null);

  useEffect(() => {
    if (!open) return;
    let isCurrent = true;
    desktopBridge
      .checkExternalTools()
      .then((res) => {
        if (isCurrent && res) {
          setToolsStatus(res);
        }
      })
      .catch((err) => {
        console.warn('Failed to check external tools:', err);
      });
    return () => {
      isCurrent = false;
    };
  }, [open]);

  const toolsFoundCount = useMemo(() => {
    if (!toolsStatus) return null;
    const tools = ['mkvmerge', 'mkvextract', 'mkvpropedit', 'ffmpeg', 'ffsubsync', 'mpv'];
    return tools.filter((t) => toolsStatus[t]?.found).length;
  }, [toolsStatus]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      if (open && initialTab === 'updates') {
        scrollRef.current.querySelector('[data-testid="update-settings"]')?.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeTab, open, initialTab]);

  if ((open && !prevOpen) || initialTab !== prevInitialTab) {
    setPrevOpen(open);
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab === 'updates' ? 'general' : initialTab || 'general');
    if (initialTab === 'updates' && !expandedSections.updates) {
      setExpandedSections({ ...expandedSections, updates: true });
    }
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const updateShortcuts = (next) => {
    if (onShortcutsChange) {
      onShortcutsChange(next);
    }
  };

  useEffect(() => {
    if (!open || editingShortcut || conflictState) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab('general');
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, editingShortcut, conflictState]);

  useEffect(() => {
    if (!open || !editingShortcut || conflictState) return;
    const handleCaptureKeyDown = (e) => {
      const combo = formatEventToShortcut(e);
      if (!combo) return;
      e.preventDefault();
      e.stopPropagation();

      const conflictingItem = ALL_SHORTCUT_ITEMS.find(
        (item) =>
          item.id !== editingShortcut.id &&
          (shortcuts[item.id] || '').toLowerCase() === combo.toLowerCase()
      );

      if (conflictingItem) {
        setConflictState({
          targetId: editingShortcut.id,
          targetLabel: editingShortcut.label,
          conflictingId: conflictingItem.id,
          conflictingLabel: conflictingItem.label,
          combo,
        });
      } else {
        onShortcutsChange?.({
          ...shortcuts,
          [editingShortcut.id]: combo,
        });
        setEditingShortcut(null);
      }
    };
    window.addEventListener('keydown', handleCaptureKeyDown, true);
    return () => window.removeEventListener('keydown', handleCaptureKeyDown, true);
  }, [open, editingShortcut, conflictState, shortcuts, onShortcutsChange]);

  const handlePickDefaultOutputDir = async () => {
    try {
      const chosen = await desktopBridge.pickFolder(settings.default_output_dir);
      if (chosen) {
        onChange({ ...settings, default_output_dir: chosen });
      }
    } catch (err) {
      console.error('Failed to pick default output folder', err);
    }
  };

  const handleClearDefaultOutputDir = () => {
    onChange({ ...settings, default_output_dir: '' });
  };

  const handleResetSingleShortcut = (item) => {
    const defaultCombo = DEFAULT_SHORTCUTS[item.id];
    const conflictingItem = ALL_SHORTCUT_ITEMS.find(
      (other) =>
        other.id !== item.id &&
        (shortcuts[other.id] || '').toLowerCase() === defaultCombo.toLowerCase()
    );
    if (conflictingItem) {
      setConflictState({
        targetId: item.id,
        targetLabel: item.label,
        conflictingId: conflictingItem.id,
        conflictingLabel: conflictingItem.label,
        combo: defaultCombo,
      });
    } else {
      updateShortcuts({
        ...shortcuts,
        [item.id]: defaultCombo,
      });
    }
  };

  const handleResetAllShortcuts = () => {
    updateShortcuts({ ...DEFAULT_SHORTCUTS });
    setEditingShortcut(null);
    setConflictState(null);
  };

  const modifiedCount = ALL_SHORTCUT_ITEMS.filter(
    (item) => (shortcuts[item.id] ?? DEFAULT_SHORTCUTS[item.id]) !== DEFAULT_SHORTCUTS[item.id]
  ).length;

  const currentThemeMode = settings.theme_mode || 'dark';

  const filteredShortcutGroups = useMemo(() => {
    const q = shortcutFilter.trim().toLowerCase();
    if (!q) return SHORTCUT_GROUPS;

    return SHORTCUT_GROUPS.map((group) => {
      const matchedItems = group.items.filter((item) => {
        const combo = (shortcuts[item.id] ?? DEFAULT_SHORTCUTS[item.id] ?? '').toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          combo.includes(q) ||
          group.category.toLowerCase().includes(q)
        );
      });
      return {
        ...group,
        items: matchedItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [shortcutFilter, shortcuts]);

  if (!open) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        restoreFocus={false}
        disableRestoreFocus={true}
        aria-label="Settings"
        aria-labelledby="settings-dialog-title"
        maxWidth={false}
        fullWidth
        slotProps={{
          transition: {
            onEntered: () => {
              if (initialTab === 'updates') {
                scrollRef.current?.querySelector('[data-testid="update-settings"]')?.scrollIntoView({ block: 'start' });
              }
            },
          },
          paper: {
            'aria-label': 'Settings',
            sx: (theme) => ({
              width: '100%',
              maxWidth: 720,
              maxHeight: 'min(88vh, 780px)',
              bgcolor: theme.palette.mode === 'light' ? '#FAFAFC' : '#0F141F',
              backgroundImage: 'none',
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              boxShadow:
                theme.palette.mode === 'light'
                  ? '0 24px 64px rgba(15, 23, 42, 0.22)'
                  : '0 24px 64px rgba(0, 0, 0, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              m: { xs: 1.5, sm: 2 },
            }),
          },
          backdrop: {
            sx: (theme) => ({
              bgcolor:
                theme.palette.mode === 'light'
                  ? 'rgba(15, 23, 42, 0.45)'
                  : 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(8px)',
            }),
          },
        }}
      >
        {/* Header & Segmented Tab Navigation */}
        <Box
          sx={(theme) => ({
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            px: { xs: 2.5, sm: 3 },
            pt: 2.25,
            pb: 1.75,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: theme.palette.mode === 'light' ? '#FAFAFC' : '#0F141F',
          })}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: 'rgba(99, 102, 241, 0.14)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Settings fontSize="small" />
              </Box>
              <Box>
                <Typography id="settings-dialog-title" variant="h6" fontWeight={800} sx={{ fontSize: '1.10rem', lineHeight: 1.2 }}>
                  Settings
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.74rem' }}>
                  Global preferences, appearance, mpv sync preview, and keyboard shortcuts
                </Typography>
              </Box>
            </Box>
            <IconButton
              size="small"
              aria-label="Close settings"
              onClick={onClose}
              sx={{
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {/* Segmented Tab Bar */}
          <Box
            role="tablist"
            aria-label="Settings pages"
            sx={(theme) => ({
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0.75,
              p: 0.5,
              borderRadius: 2,
              bgcolor:
                theme.palette.mode === 'light'
                  ? '#E8ECF2'
                  : 'rgba(15, 23, 42, 0.65)',
              border: '1px solid',
              borderColor: 'divider',
            })}
          >
            <Button
              role="tab"
              aria-selected={activeTab === 'general'}
              size="small"
              disableElevation
              startIcon={<TuneOutlined fontSize="small" />}
              onClick={() => setActiveTab('general')}
              sx={{
                borderRadius: 1.5,
                py: 0.75,
                fontSize: '0.80rem',
                fontWeight: 700,
                textTransform: 'none',
                color: activeTab === 'general' ? 'text.primary' : 'text.secondary',
                bgcolor:
                  activeTab === 'general'
                    ? 'rgba(99, 102, 241, 0.18)'
                    : 'transparent',
                border: '1px solid',
                borderColor:
                  activeTab === 'general'
                    ? 'rgba(99, 102, 241, 0.45)'
                    : 'transparent',
                '&:hover': {
                  bgcolor:
                    activeTab === 'general'
                      ? 'rgba(99, 102, 241, 0.24)'
                      : 'rgba(99, 102, 241, 0.06)',
                  color: 'text.primary',
                },
              }}
            >
              General
            </Button>
            <Button
              role="tab"
              aria-selected={activeTab === 'shortcuts'}
              size="small"
              disableElevation
              startIcon={<KeyboardOutlined fontSize="small" />}
              onClick={() => setActiveTab('shortcuts')}
              sx={{
                borderRadius: 1.5,
                py: 0.75,
                fontSize: '0.80rem',
                fontWeight: 700,
                textTransform: 'none',
                color: activeTab === 'shortcuts' ? 'text.primary' : 'text.secondary',
                bgcolor:
                  activeTab === 'shortcuts'
                    ? 'rgba(99, 102, 241, 0.18)'
                    : 'transparent',
                border: '1px solid',
                borderColor:
                  activeTab === 'shortcuts'
                    ? 'rgba(99, 102, 241, 0.45)'
                    : 'transparent',
                '&:hover': {
                  bgcolor:
                    activeTab === 'shortcuts'
                      ? 'rgba(99, 102, 241, 0.24)'
                      : 'rgba(99, 102, 241, 0.06)',
                  color: 'text.primary',
                },
              }}
            >
              Keyboard Shortcuts
              {modifiedCount > 0 && (
                <Chip
                  size="small"
                  label={modifiedCount}
                  sx={{
                    ml: 1,
                    height: 18,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    bgcolor: 'rgba(245, 158, 11, 0.2)',
                    color: 'warning.main',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                  }}
                />
              )}
            </Button>
          </Box>
        </Box>

        {/* Scrollable Content Area */}
        <Box
          ref={scrollRef}
          data-testid="settings-scroll-container"
          sx={{
            flex: 1,
            minHeight: 0,
            p: { xs: 2, sm: 2.5 },
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
          }}
        >
          {activeTab === 'general' ? (
            <>
              {/* Section Accordion Controls */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 0.5,
                  flexShrink: 0,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontSize: '0.72rem', fontWeight: 600 }}
                >
                  {Object.values(expandedSections).filter(Boolean).length} of{' '}
                  {Object.keys(expandedSections).length} sections expanded
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={toggleAllGeneral}
                  startIcon={
                    allGeneralExpanded ? (
                      <UnfoldLessOutlined sx={{ fontSize: 14 }} />
                    ) : (
                      <UnfoldMoreOutlined sx={{ fontSize: 14 }} />
                    )
                  }
                  sx={{
                    fontSize: '0.72rem',
                    py: 0.2,
                    px: 0.75,
                    color: 'primary.light',
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {allGeneralExpanded ? 'Collapse All' : 'Expand All'}
                </Button>
              </Box>

              {/* Card 1: Appearance & Theme */}
              <SectionCard
                icon={SettingsBrightnessOutlined}
                title="Appearance & Theme"
                tag={
                  currentThemeMode === 'dark'
                    ? 'Dark Mode'
                    : currentThemeMode === 'light'
                    ? 'Light Mode'
                    : 'System Default'
                }
                iconColor="primary.main"
                expanded={expandedSections.appearance}
                onToggle={() => toggleSection('appearance')}
              >
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Box
                    data-testid="theme-selector"
                    role="group"
                    aria-label="Theme mode"
                    sx={(theme) => ({
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 1,
                      p: 0.5,
                      borderRadius: 2,
                      bgcolor:
                        theme.palette.mode === 'light'
                          ? '#E8ECF2'
                          : '#0B0F18',
                      border: '1px solid',
                      borderColor: 'divider',
                    })}
                  >
                    {[
                      { id: 'dark', label: 'Dark', icon: DarkModeOutlined },
                      { id: 'light', label: 'Light', icon: LightModeOutlined },
                      { id: 'system', label: 'System', icon: SettingsBrightnessOutlined },
                    ].map((opt) => {
                      const selected = currentThemeMode === opt.id;
                      const IconComp = opt.icon;
                      return (
                        <Button
                          key={opt.id}
                          size="small"
                          data-testid={`theme-mode-${opt.id}`}
                          aria-pressed={selected}
                          startIcon={<IconComp fontSize="small" />}
                          onClick={() => onChange({ ...settings, theme_mode: opt.id })}
                          sx={{
                            borderRadius: 1.5,
                            py: 0.75,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: selected ? 'text.primary' : 'text.secondary',
                            bgcolor: selected ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                            border: '1px solid',
                            borderColor: selected ? 'rgba(99, 102, 241, 0.45)' : 'transparent',
                            '&:hover': {
                              bgcolor: selected
                                ? 'rgba(99, 102, 241, 0.24)'
                                : 'rgba(99, 102, 241, 0.08)',
                              color: 'text.primary',
                            },
                          }}
                        >
                          {opt.label}
                        </Button>
                      );
                    })}
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.71rem' }}>
                    Choose between Carbon-Slate Dark, Anodized Slate Light, or follow OS preference.
                    The live CLI console stays dark for optimal ANSI readability.
                  </Typography>
                </Box>
              </SectionCard>

              {/* Card 2: Audio & Transcoding */}
              <SectionCard
                icon={HeadphonesOutlined}
                title="Audio & Transcoding"
                tag={
                  settings.opus_mode === 'always'
                    ? `Opus: Always (${settings.opus_bitrate || 128}k)`
                    : settings.opus_mode === 'prompt'
                    ? 'Opus: Prompt'
                    : 'Opus: Disabled'
                }
                iconColor="success.main"
                expanded={expandedSections.audio}
                onToggle={() => toggleSection('audio')}
              >
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.75,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Opus Audio Encoding"
                    value={settings.opus_mode || 'off'}
                    onChange={(e) => onChange({ ...settings, opus_mode: e.target.value })}
                    helperText="Re-encode kept and merged audio tracks to Opus to save space (applied to audio muxing modes)"
                    sx={{
                      '& .MuiFormHelperText-root': {
                        color: 'text.secondary',
                        fontSize: '0.70rem',
                      },
                    }}
                  >
                    <MenuItem value="off">Disabled (Keep original audio lossless)</MenuItem>
                    <MenuItem value="prompt">Ask per batch (Interactive prompt with preview)</MenuItem>
                    <MenuItem value="always">Always convert to Opus</MenuItem>
                  </TextField>

                  {/* Aligned 2-column parameters */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1.75,
                      alignItems: 'stretch',
                    }}
                  >
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      label="Opus Bitrate (kbps)"
                      value={settings.opus_bitrate ?? 128}
                      onChange={(e) => {
                        const val = Math.max(32, Math.min(512, Number(e.target.value) || 128));
                        onChange({ ...settings, opus_bitrate: val });
                      }}
                      inputProps={{ min: 32, max: 512, step: 16 }}
                      helperText="e.g. 128k for stereo, 192k–320k for 5.1 surround"
                      disabled={settings.opus_mode === 'off'}
                      sx={{
                        '& .MuiFormHelperText-root': {
                          color: 'text.secondary',
                          fontSize: '0.70rem',
                        },
                      }}
                    />

                    <Box
                      sx={(theme) => ({
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 1.25,
                        bgcolor:
                          theme.palette.mode === 'light'
                            ? '#E8ECF2'
                            : '#0B0F18',
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: 62,
                        opacity: settings.opus_mode === 'off' ? 0.6 : 1,
                        transition: 'opacity 0.15s ease',
                      })}
                    >
                      <FormControlLabel
                        disabled={settings.opus_mode === 'off'}
                        control={
                          <Checkbox
                            size="small"
                            checked={settings.opus_downmix !== false}
                            onChange={(e) =>
                              onChange({ ...settings, opus_downmix: e.target.checked })
                            }
                            disabled={settings.opus_mode === 'off'}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, userSelect: 'none' }}>
                              Downmix to stereo (2.0)
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                fontSize: '0.70rem',
                                lineHeight: 1.25,
                              }}
                            >
                              Uncheck to preserve original channels (e.g. 5.1 / 7.1)
                            </Typography>
                          </Box>
                        }
                        sx={{ width: '100%', m: 0 }}
                      />
                    </Box>
                  </Box>
                </Box>

                <SettingToggleRow
                  title="Auto-sync Audio"
                  description="Waveform cross-correlation delay calculation (applied when merging audio)"
                  checked={settings.auto_audio ?? true}
                  onChange={(val) => onChange({ ...settings, auto_audio: val })}
                />
              </SectionCard>

              {/* Card 3: Subtitles & Synchronization */}
              <SectionCard
                icon={SubtitlesOutlined}
                title="Subtitles & Synchronization"
                tag={
                  settings.preview_mpv
                    ? 'mpv Audition'
                    : settings.auto_subs
                    ? 'FFsubsync Auto'
                    : 'FFsubsync Off'
                }
                iconColor="secondary.main"
                expanded={expandedSections.subtitles}
                onToggle={() => toggleSection('subtitles')}
              >
                <SettingToggleRow
                  title="Auto-sync Subs"
                  description="Align subtitles to audio speech with FFsubsync (applied to subtitle modes)"
                  checked={settings.auto_subs ?? true}
                  onChange={(val) => onChange({ ...settings, auto_subs: val })}
                  divider
                />

                <SettingToggleRow
                  title="Enable Max Offset limit"
                  description="Cap maximum alignment search window in seconds (applied to subtitle modes)"
                  checked={settings.enable_max_offset}
                  onChange={(val) => onChange({ ...settings, enable_max_offset: val })}
                />

                <Box
                  sx={{
                    px: 2.25,
                    pb: 2,
                    pt: 0.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <TextField
                    label="FFsubsync Max Offset (seconds)"
                    type="number"
                    size="small"
                    fullWidth
                    disabled={!settings.enable_max_offset}
                    value={settings.max_offset}
                    onChange={(e) => onChange({ ...settings, max_offset: e.target.value })}
                    helperText="Restricts ffsubsync alignment search to this maximum number of seconds"
                    sx={{
                      '& .MuiFormHelperText-root': { fontSize: '0.70rem' },
                    }}
                  />
                </Box>

                <SettingToggleRow
                  icon={PlayArrow}
                  title="Preview sync with mpv before muxing"
                  description="Open an interactive verification dialog after delay calculation to audition and nudge audio/subtitle offsets in mpv before final remuxing"
                  checked={settings.preview_mpv}
                  onChange={(val) => onChange({ ...settings, preview_mpv: val })}
                />
              </SectionCard>

              {/* Card 4: OpenSubtitles.com API Integration */}
              <SectionCard
                testId="opensubtitles-settings-card"
                icon={KeyOutlined}
                title="OpenSubtitles.com API Integration"
                iconColor="primary.main"
                expanded={expandedSections.opensubtitles}
                onToggle={() => toggleSection('opensubtitles')}
                headerAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {settings.opensubtitles_api_key ? (
                      <Chip
                        size="small"
                        icon={<CheckCircleOutlined sx={{ fontSize: '13px !important' }} />}
                        label="Configured"
                        color="success"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.66rem', fontWeight: 700 }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        label="Optional"
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          color: 'text.secondary',
                        }}
                      />
                    )}
                    <Button
                      size="small"
                      variant="text"
                      component="a"
                      href="https://www.opensubtitles.com/en/consumers"
                      target="_blank"
                      rel="noreferrer"
                      endIcon={<OpenInNewOutlined sx={{ fontSize: 13 }} />}
                      sx={{
                        fontSize: '0.72rem',
                        textTransform: 'none',
                        py: 0.25,
                        px: 0.75,
                        color: 'primary.main',
                      }}
                    >
                      Get Free API Key
                    </Button>
                  </Box>
                }
              >
                <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontSize: '0.72rem', lineHeight: 1.4 }}
                  >
                    Required for searching and downloading missing subtitles directly through AI
                    agents and MCP tools. The key is stored in your local configuration and shared
                    across the GUI and AI assistants.
                  </Typography>

                  <TextField
                    label="OpenSubtitles API Key"
                    data-testid="opensubtitles-api-key-input"
                    type={showApiKey ? 'text' : 'password'}
                    size="small"
                    fullWidth
                    value={settings.opensubtitles_api_key || ''}
                    placeholder="Enter your OpenSubtitles API Consumer Key"
                    onChange={(e) =>
                      onChange({ ...settings, opensubtitles_api_key: e.target.value.trim() })
                    }
                    helperText={
                      settings.opensubtitles_api_key
                        ? 'Stored in shared user configuration (~/.config/syncforge/config.json)'
                        : 'Leave empty if you do not use online subtitle search tools'
                    }
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                              onClick={() => setShowApiKey(!showApiKey)}
                              edge="end"
                              sx={{
                                p: 0.5,
                                color: 'text.secondary',
                                mr: settings.opensubtitles_api_key ? 0.5 : 0,
                              }}
                            >
                              {showApiKey ? (
                                <VisibilityOffOutlined sx={{ fontSize: 16 }} />
                              ) : (
                                <VisibilityOutlined sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                            {settings.opensubtitles_api_key ? (
                              <Tooltip title="Clear OpenSubtitles API Key" arrow>
                                <IconButton
                                  size="small"
                                  aria-label="Clear API key"
                                  onClick={() =>
                                    onChange({ ...settings, opensubtitles_api_key: '' })
                                  }
                                  edge="end"
                                  sx={{ p: 0.5, color: 'text.secondary' }}
                                >
                                  <ClearIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            ) : null}
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{
                      '& .MuiFormHelperText-root': { fontSize: '0.70rem' },
                    }}
                  />

                  <TextField
                    label="OpenSubtitles User Token (Optional VIP / JWT)"
                    type={showApiToken ? 'text' : 'password'}
                    size="small"
                    fullWidth
                    value={settings.opensubtitles_token || ''}
                    placeholder="Optional User VIP / Bearer Token"
                    onChange={(e) =>
                      onChange({ ...settings, opensubtitles_token: e.target.value.trim() })
                    }
                    helperText="Optional: increases daily download quotas for registered or VIP accounts"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              size="small"
                              aria-label={showApiToken ? 'Hide token' : 'Show token'}
                              onClick={() => setShowApiToken(!showApiToken)}
                              edge="end"
                              sx={{
                                p: 0.5,
                                color: 'text.secondary',
                                mr: settings.opensubtitles_token ? 0.5 : 0,
                              }}
                            >
                              {showApiToken ? (
                                <VisibilityOffOutlined sx={{ fontSize: 16 }} />
                              ) : (
                                <VisibilityOutlined sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                            {settings.opensubtitles_token ? (
                              <Tooltip title="Clear User Token" arrow>
                                <IconButton
                                  size="small"
                                  aria-label="Clear user token"
                                  onClick={() =>
                                    onChange({ ...settings, opensubtitles_token: '' })
                                  }
                                  edge="end"
                                  sx={{ p: 0.5, color: 'text.secondary' }}
                                >
                                  <ClearIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            ) : null}
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{
                      '& .MuiFormHelperText-root': { fontSize: '0.70rem' },
                    }}
                  />
                </Box>
              </SectionCard>

              {/* Card 5: Default Output Directory */}
              <SectionCard
                icon={FolderOpenOutlined}
                title="Default Output Directory"
                tag={settings.default_output_dir ? 'Custom Directory' : 'Source Directory'}
                iconColor="warning.main"
                expanded={expandedSections.output}
                onToggle={() => toggleSection('output')}
              >
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Default Output Folder"
                      value={settings.default_output_dir || ''}
                      placeholder="Defaults to source folder if empty"
                      onChange={(e) =>
                        onChange({ ...settings, default_output_dir: e.target.value })
                      }
                      helperText={
                        settings.default_output_dir
                          ? 'All processed files will default to this folder'
                          : 'If not configured, output files default to the source video folder'
                      }
                      slotProps={{
                        input: {
                          endAdornment: settings.default_output_dir ? (
                            <InputAdornment position="end">
                              <Tooltip title="Clear default output folder" arrow>
                                <IconButton
                                  size="small"
                                  aria-label="Clear default output folder"
                                  onClick={handleClearDefaultOutputDir}
                                  edge="end"
                                  sx={{ p: 0.5, color: 'text.secondary' }}
                                >
                                  <ClearIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          ) : null,
                        },
                      }}
                      sx={{
                        '& .MuiFormHelperText-root': { fontSize: '0.70rem' },
                      }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FolderOpenOutlined fontSize="small" />}
                      onClick={handlePickDefaultOutputDir}
                      sx={{ flexShrink: 0, height: 40, px: 2.25, fontWeight: 600, borderRadius: 1.5 }}
                    >
                      Browse
                    </Button>
                  </Box>
                </Box>
              </SectionCard>

              {/* Card 6: Notifications & Sound */}
              <SectionCard
                icon={NotificationsActiveOutlined}
                title="Notifications & Feedback"
                tag={
                  settings.notify_on_finish && settings.sound_on_finish
                    ? 'Toast & Chime'
                    : settings.notify_on_finish
                    ? 'Toast Only'
                    : settings.sound_on_finish
                    ? 'Chime Only'
                    : 'Muted'
                }
                iconColor="info.main"
                expanded={expandedSections.notifications}
                onToggle={() => toggleSection('notifications')}
              >
                <SettingToggleRow
                  title="Notify when task finishes"
                  description="Displays a desktop notification when processing completes"
                  checked={settings.notify_on_finish ?? true}
                  onChange={(val) => onChange({ ...settings, notify_on_finish: val })}
                  divider
                />

                <SettingToggleRow
                  title="Play sound on completion"
                  description="Plays a gentle chime on success or alert sound on error"
                  checked={settings.sound_on_finish ?? true}
                  onChange={(val) => onChange({ ...settings, sound_on_finish: val })}
                />
              </SectionCard>

              {/* Card 7: Portable Mode & External Tools */}
              <SectionCard
                icon={InfoOutlined}
                title="Portable Mode & External Tools"
                tag={
                  toolsFoundCount !== null
                    ? `${toolsFoundCount}/6 Ready`
                    : 'Tools & Binaries'
                }
                iconColor="secondary.main"
                expanded={expandedSections.portable}
                onToggle={() => toggleSection('portable')}
              >
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {['mkvmerge', 'mkvextract', 'mkvpropedit', 'ffmpeg', 'ffsubsync', 'mpv'].map((tool) => {
                      const info = toolsStatus ? toolsStatus[tool] : null;
                      const isGreen = info ? info.found === true : false;
                      const isRed = info ? info.found === false : false;

                      const tooltipText = isGreen
                        ? info.path
                          ? `Found: ${info.path}`
                          : `${tool} detected in PATH or application directory`
                        : isRed
                        ? `${tool} not found in PATH or application directory`
                        : `Checking ${tool}...`;

                      return (
                        <Tooltip key={tool} title={tooltipText} arrow>
                          <Box
                            component="span"
                            data-testid={`tool-status-${tool}`}
                            data-status={isGreen ? 'found' : isRed ? 'missing' : 'checking'}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.6,
                              px: 1,
                              py: 0.35,
                              borderRadius: 1.25,
                              bgcolor: isGreen
                                ? 'rgba(34, 197, 94, 0.12)'
                                : isRed
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'action.hover',
                              border: '1px solid',
                              borderColor: isGreen
                                ? 'rgba(34, 197, 94, 0.38)'
                                : isRed
                                ? 'rgba(239, 68, 68, 0.38)'
                                : 'divider',
                              fontFamily: 'monospace',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: isGreen
                                ? '#4ADE80'
                                : isRed
                                ? '#F87171'
                                : 'text.secondary',
                              transition: 'all 0.15s ease',
                              cursor: 'default',
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: isGreen
                                  ? '#22C55E'
                                  : isRed
                                  ? '#EF4444'
                                  : 'text.disabled',
                                flexShrink: 0,
                              }}
                            />
                            {tool}
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.5 }}>
                    SyncForge automatically detects MKVToolNix (<code>mkvmerge</code>, <code>mkvextract</code>,{' '}
                    <code>mkvpropedit</code>), FFmpeg (<code>ffmpeg</code>), ffsubsync (<code>ffsubsync</code>),
                    and mpv (<code>mpv</code>). You can install them system-wide or place their executables directly
                    in the application folder (or a <code>tools/</code> or <code>bin/</code> subfolder) for full
                    portability.
                  </Typography>
                </Box>
              </SectionCard>
              {updater && (
                <SectionCard icon={SystemUpdateAltOutlined} title="Application updates" testId="update-settings" expanded={expandedSections.updates} onToggle={() => toggleSection('updates')}>
                  {updater.info?.supported && <SettingToggleRow
                    title="Automatically download updates"
                    description="Check at startup and every four hours. You choose when to restart and install."
                    checked={settings.auto_update !== false}
                    onChange={(checked) => onChange({ ...settings, auto_update: checked })}
                    divider
                  />}
                  <UpdateSettings updater={updater} running={running} />
                </SectionCard>
              )}
            </>
          ) : (
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
              data-testid="shortcuts-page"
            >
              {/* Shortcuts Toolbar & Search */}
              <Box
                sx={(theme) => ({
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2.5,
                  bgcolor:
                    theme.palette.mode === 'light'
                      ? '#FFFFFF'
                      : '#111622',
                  border: '1px solid',
                  borderColor: 'divider',
                })}
              >
                <TextField
                  size="small"
                  placeholder="Filter shortcuts..."
                  value={shortcutFilter}
                  onChange={(e) => setShortcutFilter(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: shortcutFilter ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            aria-label="Clear filter"
                            onClick={() => setShortcutFilter('')}
                            edge="end"
                            sx={{ p: 0.5 }}
                          >
                            <ClearIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    },
                  }}
                  sx={{
                    flex: 1,
                    maxWidth: 320,
                    '& .MuiOutlinedInput-root': {
                      fontSize: '0.78rem',
                      height: 34,
                    },
                  }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {modifiedCount > 0 && (
                    <Chip
                      size="small"
                      label={`${modifiedCount} customized`}
                      sx={{
                        height: 22,
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        bgcolor: 'rgba(245, 158, 11, 0.16)',
                        color: 'warning.main',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                      }}
                    />
                  )}
                  <Button
                    size="small"
                    variant="text"
                    onClick={toggleAllShortcuts}
                    startIcon={
                      allShortcutsExpanded ? (
                        <UnfoldLessOutlined sx={{ fontSize: 14 }} />
                      ) : (
                        <UnfoldMoreOutlined sx={{ fontSize: 14 }} />
                      )
                    }
                    sx={{
                      fontSize: '0.74rem',
                      height: 34,
                      px: 1,
                      color: 'primary.light',
                      textTransform: 'none',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {allShortcutsExpanded ? 'Collapse All' : 'Expand All'}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    aria-label="Reset all shortcuts"
                    disabled={modifiedCount === 0}
                    startIcon={<RestartAlt fontSize="small" />}
                    onClick={handleResetAllShortcuts}
                    sx={{
                      fontSize: '0.74rem',
                      height: 34,
                      px: 1.5,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    Reset All
                  </Button>
                </Box>
              </Box>

              {filteredShortcutGroups.length === 0 ? (
                <Box
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    borderRadius: 2,
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No shortcuts matched &ldquo;{shortcutFilter}&rdquo;
                  </Typography>
                </Box>
              ) : (
                filteredShortcutGroups.map((group) => (
                  <Box
                    key={group.category}
                    sx={(theme) => ({
                      flexShrink: 0,
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor:
                        theme.palette.mode === 'light'
                          ? '#FFFFFF'
                          : '#111622',
                      overflow: 'hidden',
                    })}
                  >
                    {/* Category Header */}
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-expanded={expandedShortcutGroups[group.category] !== false}
                      onClick={() => toggleShortcutGroup(group.category)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleShortcutGroup(group.category);
                        }
                      }}
                      sx={(theme) => ({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1.15,
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderBottom:
                          expandedShortcutGroups[group.category] !== false ? '1px solid' : 'none',
                        borderColor: 'divider',
                        bgcolor:
                          theme.palette.mode === 'light'
                            ? '#F4F6F9'
                            : '#0B0F18',
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor:
                            theme.palette.mode === 'light'
                              ? '#ECEFF4'
                              : '#0E1320',
                        },
                      })}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <KeyboardOutlined sx={{ color: group.color, fontSize: 17 }} />
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          sx={{
                            color: group.color,
                            fontSize: '0.80rem',
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {group.category}
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          size="small"
                          label={`${group.items.length} shortcut${group.items.length === 1 ? '' : 's'}`}
                          sx={{
                            height: 20,
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            bgcolor: 'action.hover',
                            color: 'text.secondary',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        />
                        <Box
                          aria-hidden="true"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 0.25,
                            color: 'text.secondary',
                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform:
                              expandedShortcutGroups[group.category] !== false
                                ? 'rotate(180deg)'
                                : 'rotate(0deg)',
                          }}
                        >
                          <KeyboardArrowDown sx={{ fontSize: 18 }} />
                        </Box>
                      </Box>
                    </Box>

                    <Collapse
                      in={expandedShortcutGroups[group.category] !== false}
                      timeout="auto"
                      unmountOnExit={false}
                    >
                      {/* Shortcut Items */}
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      {group.items.map((item, index) => {
                        const combo = shortcuts[item.id] ?? DEFAULT_SHORTCUTS[item.id];
                        const isModified = combo !== DEFAULT_SHORTCUTS[item.id];
                        const keys = splitShortcutKeys(combo);
                        const isLast = index === group.items.length - 1;

                        return (
                          <Box
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Change shortcut for ${item.label}`}
                            data-testid={`shortcut-row-${item.id}`}
                            onClick={() => {
                              setConflictState(null);
                              setEditingShortcut(item);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setConflictState(null);
                                setEditingShortcut(item);
                              }
                            }}
                            sx={(theme) => ({
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              py: 1,
                              px: 2,
                              cursor: 'pointer',
                              borderBottom: isLast ? 'none' : '1px solid',
                              borderColor: 'divider',
                              bgcolor: isModified
                                ? 'rgba(245, 158, 11, 0.05)'
                                : 'transparent',
                              transition: 'all 0.12s ease',
                              '&:hover': {
                                bgcolor: isModified
                                  ? 'rgba(245, 158, 11, 0.10)'
                                  : theme.palette.mode === 'light'
                                  ? 'rgba(99, 102, 241, 0.05)'
                                  : 'rgba(99, 102, 241, 0.08)',
                              },
                            })}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontSize: '0.83rem',
                                  color: 'text.primary',
                                  fontWeight: isModified ? 600 : 500,
                                }}
                              >
                                {item.label}
                              </Typography>
                              {isModified && (
                                <Tooltip
                                  title={`Modified (Default: ${formatShortcutDisplay(
                                    DEFAULT_SHORTCUTS[item.id]
                                  )})`}
                                  arrow
                                >
                                  <Box
                                    component="span"
                                    data-testid={`shortcut-modified-${item.id}`}
                                    sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 0.4,
                                      px: 0.75,
                                      py: 0.15,
                                      borderRadius: 1,
                                      bgcolor: 'rgba(245, 158, 11, 0.16)',
                                      border: '1px solid rgba(245, 158, 11, 0.35)',
                                      color: '#FBBF24',
                                      fontSize: '0.66rem',
                                      fontWeight: 700,
                                    }}
                                  >
                                    <EditOutlined sx={{ fontSize: 12 }} />
                                    Edited
                                  </Box>
                                </Tooltip>
                              )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              {keys.length > 0 ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  {keys.map((key, kIdx) => (
                                    <Box
                                      component="kbd"
                                      key={kIdx}
                                      sx={(theme) => ({
                                        px: 1,
                                        py: 0.28,
                                        minWidth: 28,
                                        textAlign: 'center',
                                        fontFamily: 'monospace',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        color: isModified
                                          ? '#FBBF24'
                                          : theme.palette.mode === 'light'
                                          ? '#0F172A'
                                          : '#E2E8F0',
                                        bgcolor:
                                          theme.palette.mode === 'light'
                                            ? '#F1F3F7'
                                            : '#161E2E',
                                        border: '1px solid',
                                        borderColor: isModified
                                          ? 'rgba(245, 158, 11, 0.45)'
                                          : 'divider',
                                        borderBottomWidth: '2px',
                                        borderRadius: 1,
                                        boxShadow:
                                          theme.palette.mode === 'light'
                                            ? '0 1px 2px rgba(15, 23, 42, 0.08)'
                                            : '0 1px 2px rgba(0,0,0,0.4)',
                                      })}
                                    >
                                      {key}
                                    </Box>
                                  ))}
                                </Box>
                              ) : (
                                <Chip
                                  size="small"
                                  label="Unassigned"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.70rem',
                                    fontFamily: 'monospace',
                                    bgcolor: 'rgba(239, 68, 68, 0.12)',
                                    color: '#F87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                  }}
                                />
                              )}

                              {isModified && (
                                <Tooltip
                                  title={`Reset to default (${DEFAULT_SHORTCUTS[item.id]})`}
                                  arrow
                                >
                                  <IconButton
                                    size="small"
                                    aria-label={`Reset shortcut for ${item.label}`}
                                    data-testid={`reset-shortcut-${item.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResetSingleShortcut(item);
                                    }}
                                    sx={{
                                      p: 0.4,
                                      color: '#FBBF24',
                                      bgcolor: 'rgba(245, 158, 11, 0.10)',
                                      '&:hover': {
                                        bgcolor: 'rgba(245, 158, 11, 0.22)',
                                      },
                                    }}
                                  >
                                    <RestartAlt sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Collapse>
                </Box>
                ))
              )}

              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <InfoOutlined sx={{ color: '#818CF8', fontSize: 16, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.73rem', color: 'text.secondary' }}>
                  On macOS, you can use <code style={{ color: 'inherit', fontWeight: 700 }}>Cmd (⌘)</code>{' '}
                  in place of <code style={{ color: 'inherit', fontWeight: 700 }}>Ctrl</code> for all
                  global shortcuts.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Footer Actions */}
        <Box
          sx={(theme) => ({
            px: { xs: 2.5, sm: 3 },
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: theme.palette.mode === 'light' ? '#FAFAFC' : '#0F141F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              component="kbd"
              sx={(theme) => ({
                px: 0.75,
                py: 0.2,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor:
                  theme.palette.mode === 'light'
                    ? '#E8ECF2'
                    : '#111827',
                fontFamily: 'monospace',
                fontSize: '0.68rem',
                color: 'text.secondary',
              })}
            >
              Esc
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
              to close
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={onClose}
            sx={{ px: 3.5, fontWeight: 700, borderRadius: 2 }}
          >
            Done
          </Button>
        </Box>
      </Dialog>

      {/* Sub-dialog 1: Capture New Shortcut */}
      <Dialog
        open={Boolean(editingShortcut && !conflictState)}
        onClose={() => setEditingShortcut(null)}
        aria-label="Change Shortcut"
        data-testid="shortcut-capture-dialog"
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: (theme) => ({
              bgcolor: theme.palette.mode === 'light' ? '#FFFFFF' : '#111827',
              backgroundImage: 'none',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: 2.5,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.95)',
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }),
          },
          backdrop: {
            sx: {
              bgcolor: 'rgba(0, 0, 0, 0.76)',
              backdropFilter: 'blur(6px)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <KeyboardOutlined sx={{ color: '#818CF8' }} />
          <Typography variant="h6" fontWeight={700} fontSize="1rem">
            Change Shortcut
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          Press the new key combination for{' '}
          <strong style={{ color: 'inherit' }}>{editingShortcut?.label}</strong>:
        </Typography>
        <Box
          sx={{
            py: 2.25,
            px: 2,
            borderRadius: 2,
            bgcolor: 'rgba(7, 10, 16, 0.85)',
            border: '1px dashed rgba(99, 102, 241, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: '#818CF8',
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Listening for key combination...
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Current:{' '}
            <code style={{ color: '#E2E8F0' }}>
              {(editingShortcut && shortcuts[editingShortcut.id]) || 'Unassigned'}
            </code>
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Button
            size="small"
            color="warning"
            variant="outlined"
            onClick={() => {
              if (editingShortcut) {
                updateShortcuts({
                  ...shortcuts,
                  [editingShortcut.id]: '',
                });
                setEditingShortcut(null);
              }
            }}
          >
            Unbind
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setEditingShortcut(null)}
          >
            Cancel
          </Button>
        </Box>
      </Dialog>

      {/* Sub-dialog 2: Conflict Resolution */}
      <Dialog
        open={Boolean(conflictState)}
        onClose={() => {
          setConflictState(null);
          setEditingShortcut(null);
        }}
        aria-label="Shortcut Conflict"
        data-testid="shortcut-conflict-dialog"
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: (theme) => ({
              bgcolor: theme.palette.mode === 'light' ? '#FFFFFF' : '#111827',
              backgroundImage: 'none',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              borderRadius: 2.5,
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.95)',
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }),
          },
          backdrop: {
            sx: {
              bgcolor: 'rgba(0, 0, 0, 0.80)',
              backdropFilter: 'blur(6px)',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <WarningAmberRounded sx={{ color: '#F59E0B' }} />
          <Typography variant="h6" fontWeight={700} fontSize="1rem">
            Shortcut Already Mapped
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
          The shortcut{' '}
          <code
            style={{
              color: '#FBBF24',
              fontWeight: 700,
              background: 'rgba(245, 158, 11, 0.14)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {conflictState?.combo}
          </code>{' '}
          is already assigned to{' '}
          <strong style={{ color: 'inherit' }}>{conflictState?.conflictingLabel}</strong>. Do you
          want to cancel or assign it to{' '}
          <strong style={{ color: 'inherit' }}>{conflictState?.targetLabel}</strong> and remove
          it from <strong style={{ color: 'inherit' }}>{conflictState?.conflictingLabel}</strong>
          ?
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.25 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setConflictState(null);
              setEditingShortcut(null);
            }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="warning"
            onClick={() => {
              if (conflictState) {
                updateShortcuts({
                  ...shortcuts,
                  [conflictState.conflictingId]: '',
                  [conflictState.targetId]: conflictState.combo,
                });
                setConflictState(null);
                setEditingShortcut(null);
              }
            }}
          >
            Reassign Shortcut
          </Button>
        </Box>
      </Dialog>
    </>
  );
}
