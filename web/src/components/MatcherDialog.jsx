import { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import DragHandle from '@mui/icons-material/DragHandle';
import AutoFixHigh from '@mui/icons-material/AutoFixHigh';
import SwapVert from '@mui/icons-material/SwapVert';
import RestartAlt from '@mui/icons-material/RestartAlt';
import MoveDown from '@mui/icons-material/MoveDown';
import Close from '@mui/icons-material/Close';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { Reorder } from 'framer-motion';

const formatPath = (path) => (path ? path.split(/[\\/]/).at(-1) : '');

function extractEpisodeKey(filePath) {
  if (!filePath) return null;
  const base = formatPath(filePath).replace(/\.[^.]+$/, '');
  const cleaned = base
    .replace(/\[[0-9A-Fa-f]{8}\]/g, ' ')
    .replace(/(?:^|[^0-9])(?:19|20)\d{2}(?:$|[^0-9])/g, ' ')
    .replace(
      /(?:^|[^a-zA-Z0-9])(?:2160p|1080p|720p|576p|480p|4k|uhd|x264|x265|h\.?264|h\.?265|hevc|av1|10bit|8bit|aac\d*(?:\.\d+)?|eac3|ac3|ddp\d*(?:\.\d+)?|flac|dts|mp3|bluray|web-?dl|webrip|bdrip|remux)(?:$|[^a-zA-Z0-9])/gi,
      ' '
    );

  const seMatch = cleaned.match(/(?:^|[^a-zA-Z0-9])S(\d{1,2})\s*[._-]?\s*E(\d{1,3})(?:$|[^a-zA-Z0-9])/i);
  if (seMatch) {
    return {
      season: parseInt(seMatch[1], 10),
      episode: parseInt(seMatch[2], 10),
    };
  }

  const xMatch = cleaned.match(/(?:^|[^a-zA-Z0-9])(\d{1,2})x(\d{1,3})(?:$|[^a-zA-Z0-9])/i);
  if (xMatch) {
    return {
      season: parseInt(xMatch[1], 10),
      episode: parseInt(xMatch[2], 10),
    };
  }

  const epNamed = cleaned.match(/(?:^|[^a-zA-Z0-9])(?:episode|ep\.?|e)\.?\s*(\d{1,3})(?:v\d)?(?:$|[^a-zA-Z0-9])/i);
  if (epNamed) {
    return { season: null, episode: parseInt(epNamed[1], 10) };
  }

  const dashMatch = cleaned.match(/(?:[-_]\s*|\s+-\s+)(\d{1,3})(?:v\d)?(?:$|[^0-9])/);
  if (dashMatch) {
    return { season: null, episode: parseInt(dashMatch[1], 10) };
  }

  const allNums = [...cleaned.matchAll(/(?:^|[^0-9])(\d{1,3})(?:$|[^0-9])/g)];
  if (allNums.length > 0) {
    const last = allNums[allNums.length - 1];
    return { season: null, episode: parseInt(last[1], 10) };
  }

  return null;
}

export default function MatcherDialog({
  state,
  sources,
  onReorder,
  onCancel,
  onConfirm,
  onStop,
  stopping,
}) {
  const [excludedTargets, setExcludedTargets] = useState([]);

  const toggleExclude = (idx) => {
    setExcludedTargets((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleAutoMatch = () => {
    const remaining = sources
      .filter((s) => !s.isGap && s.path)
      .map((s) => ({ item: s, key: extractEpisodeKey(s.path) }));
    const matched = new Array(state.targets.length).fill(null);

    state.targets.forEach((targetPath, tIdx) => {
      const tKey = extractEpisodeKey(targetPath);
      if (!tKey) return;

      let matchIdx = -1;
      if (tKey.season !== null) {
        matchIdx = remaining.findIndex(
          (cand) =>
            cand.key &&
            cand.key.season === tKey.season &&
            cand.key.episode === tKey.episode
        );
      }
      if (matchIdx === -1) {
        matchIdx = remaining.findIndex(
          (cand) => cand.key && cand.key.episode === tKey.episode
        );
      }
      if (matchIdx !== -1) {
        matched[tIdx] = remaining.splice(matchIdx, 1)[0].item;
      }
    });

    const newOrder = [];
    for (let i = 0; i < state.targets.length; i++) {
      if (matched[i]) {
        newOrder.push(matched[i]);
      } else if (remaining.length > 0) {
        newOrder.push(remaining.shift().item);
      }
    }
    newOrder.push(...remaining.map((r) => r.item));
    onReorder(newOrder);
  };

  const handleReverseOrder = () => {
    onReorder([...sources].reverse());
  };

  const handleResetOrder = () => {
    onReorder([...(state.sources || [])]);
    setExcludedTargets([]);
  };

  const handleInsertGap = (idx) => {
    const next = [...sources];
    next.splice(idx, 0, {
      id: `gap-${idx}-${sources.length}`,
      path: '',
      isGap: true,
    });
    onReorder(next);
  };

  const handleRemoveGap = (gapId) => {
    onReorder(sources.filter((s) => s.id !== gapId));
  };

  const diagnostics = useMemo(() => {
    const sourceEpCounts = new Map();
    for (const s of sources) {
      if (s.isGap || !s.path) continue;
      const key = extractEpisodeKey(s.path);
      if (key) {
        sourceEpCounts.set(key.episode, (sourceEpCounts.get(key.episode) || 0) + 1);
      }
    }

    const duplicateEpisodes = [];
    for (const [ep, count] of sourceEpCounts.entries()) {
      if (count > 1) {
        duplicateEpisodes.push(`E${String(ep).padStart(2, '0')}`);
      }
    }

    const missingEpisodes = [];
    const mismatchedRows = new Set();

    state.targets.forEach((t, idx) => {
      if (excludedTargets.includes(idx)) return;
      const tKey = extractEpisodeKey(t);
      const sItem = sources[idx];
      const sKey = sItem && !sItem.isGap && sItem.path ? extractEpisodeKey(sItem.path) : null;

      if (tKey) {
        if (!sourceEpCounts.has(tKey.episode)) {
          const label = `E${String(tKey.episode).padStart(2, '0')}`;
          if (!missingEpisodes.includes(label)) {
            missingEpisodes.push(label);
          }
        }
        if (sKey && (tKey.episode !== sKey.episode || (tKey.season !== null && sKey.season !== null && tKey.season !== sKey.season))) {
          mismatchedRows.add(idx);
        }
      }
    });

    return {
      duplicateEpisodes,
      missingEpisodes,
      mismatchedRows,
      sourceEpCounts,
    };
  }, [state.targets, sources, excludedTargets]);

  const limit = Math.min(state.targets.length, sources.length);
  let activePairsCount = 0;
  for (let i = 0; i < limit; i++) {
    if (!excludedTargets.includes(i) && sources[i] && !sources[i].isGap && sources[i].path) {
      activePairsCount += 1;
    }
  }

  return (
    <Dialog open={state.open} onClose={onCancel} maxWidth="xl" fullWidth>
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <span>Pairing Screen (Drag & Drop)</span>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoFixHigh fontSize="small" />}
            onClick={handleAutoMatch}
          >
            Auto-Match Episodes
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SwapVert fontSize="small" />}
            onClick={handleReverseOrder}
          >
            Reverse Order
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestartAlt fontSize="small" />}
            onClick={handleResetOrder}
          >
            Reset Order
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(148, 163, 184, 0.12)' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Drag the source files on the right to match the correct target files on the left, insert gaps to shift misaligned episodes down, or uncheck rows to skip specific episodes.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {diagnostics.duplicateEpisodes.length > 0 && (
              <Chip
                size="small"
                icon={<WarningAmberOutlined sx={{ fontSize: 15 }} />}
                label={`Duplicate: ${diagnostics.duplicateEpisodes.join(', ')}`}
                color="warning"
                variant="outlined"
                sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem' }}
              />
            )}
            {diagnostics.missingEpisodes.length > 0 && (
              <Chip
                size="small"
                icon={<WarningAmberOutlined sx={{ fontSize: 15 }} />}
                label={`Missing: ${diagnostics.missingEpisodes.join(', ')}`}
                color="warning"
                variant="outlined"
                sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem' }}
              />
            )}
            {diagnostics.mismatchedRows.size > 0 && (
              <Chip
                size="small"
                icon={<WarningAmberOutlined sx={{ fontSize: 15 }} />}
                label={`${diagnostics.mismatchedRows.size} mismatch(es)`}
                color="error"
                variant="outlined"
                sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem' }}
              />
            )}
            <Chip
              size="small"
              label={`${Math.max(0, activePairsCount)} pair(s) active`}
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Targets
            </Typography>
            <List dense sx={{ p: 0 }}>
              {state.targets.map((t, idx) => {
                const isExcluded = excludedTargets.includes(idx);
                const epInfo = extractEpisodeKey(t);
                const isMismatch = diagnostics.mismatchedRows.has(idx);
                return (
                  <ListItem
                    key={idx}
                    sx={{
                      bgcolor: '#0B0F18',
                      border: '1px solid',
                      borderColor: isMismatch
                        ? 'rgba(245, 158, 11, 0.5)'
                        : 'rgba(148, 163, 184, 0.14)',
                      mb: 1,
                      borderRadius: 1.5,
                      height: 46,
                      p: 1,
                      overflow: 'hidden',
                      opacity: isExcluded ? 0.45 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                    }}
                  >
                    <Tooltip
                      title={isExcluded ? 'Include in batch' : 'Skip this file'}
                      arrow
                    >
                      <Checkbox
                        size="small"
                        checked={!isExcluded}
                        onChange={() => toggleExclude(idx)}
                        slotProps={{
                          input: {
                            'aria-label': `Include target ${formatPath(t)}`,
                          },
                        }}
                        sx={{ p: 0.25 }}
                      />
                    </Tooltip>
                    {epInfo && (
                      <Chip
                        size="small"
                        label={
                          epInfo.season !== null
                            ? `S${String(epInfo.season).padStart(2, '0')}E${String(epInfo.episode).padStart(2, '0')}`
                            : `E${String(epInfo.episode).padStart(2, '0')}`
                        }
                        sx={{
                          height: 20,
                          fontSize: '0.68rem',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          bgcolor: 'rgba(56, 189, 248, 0.14)',
                          color: '#38BDF8',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Tooltip title={formatPath(t)} placement="left" arrow>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          fontFamily: 'monospace',
                          textDecoration: isExcluded ? 'line-through' : 'none',
                        }}
                      >
                        {formatPath(t)}
                      </Typography>
                    </Tooltip>
                    {isMismatch && !isExcluded && (
                      <Chip
                        size="small"
                        label="Mismatch"
                        color="warning"
                        variant="outlined"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </ListItem>
                );
              })}
            </List>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Sources (Drag to reorder)
            </Typography>
            <Reorder.Group
              axis="y"
              values={sources}
              onReorder={onReorder}
              style={{ listStyleType: 'none', padding: 0, margin: 0 }}
            >
              {sources.map((s, idx) => {
                const isExcluded = excludedTargets.includes(idx);
                const isGap = Boolean(s.isGap || !s.path);
                const epInfo = isGap ? null : extractEpisodeKey(s.path);
                const isDuplicate =
                  epInfo && (diagnostics.sourceEpCounts.get(epInfo.episode) || 0) > 1;
                return (
                  <Reorder.Item
                    key={s.id}
                    value={s}
                    style={{ marginBottom: 8, height: 46, cursor: 'grab' }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1.25,
                        bgcolor: isGap
                          ? 'rgba(148, 163, 184, 0.04)'
                          : 'rgba(99, 102, 241, 0.16)',
                        border: isGap
                          ? '1.5px dashed rgba(148, 163, 184, 0.28)'
                          : '1px solid rgba(99, 102, 241, 0.4)',
                        color: 'text.primary',
                        height: '100%',
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        opacity: isExcluded ? 0.45 : 1,
                      }}
                    >
                      <DragHandle
                        sx={{
                          mr: 1,
                          opacity: 0.7,
                          flexShrink: 0,
                          color: isGap ? 'text.secondary' : '#818CF8',
                        }}
                      />
                      {isGap ? (
                        <>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              fontFamily: 'monospace',
                              fontStyle: 'italic',
                              color: 'text.secondary',
                              fontSize: '0.8rem',
                            }}
                          >
                            Empty Slot (Skipped)
                          </Typography>
                          <Tooltip title="Remove gap and shift up" arrow>
                            <IconButton
                              size="small"
                              aria-label={`Remove gap at row ${idx + 1}`}
                              onClick={() => handleRemoveGap(s.id)}
                              sx={{ p: 0.4, color: 'text.secondary' }}
                            >
                              <Close sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          {epInfo && (
                            <Chip
                              size="small"
                              label={
                                epInfo.season !== null
                                  ? `S${String(epInfo.season).padStart(2, '0')}E${String(epInfo.episode).padStart(2, '0')}`
                                  : `E${String(epInfo.episode).padStart(2, '0')}`
                              }
                              sx={{
                                mr: 0.75,
                                height: 20,
                                fontSize: '0.68rem',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                bgcolor: 'rgba(99, 102, 241, 0.25)',
                                color: '#A5B4FC',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <Tooltip title={formatPath(s.path)} placement="right" arrow>
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                fontFamily: 'monospace',
                                textDecoration: isExcluded ? 'line-through' : 'none',
                              }}
                            >
                              {formatPath(s.path)}
                            </Typography>
                          </Tooltip>
                          {isDuplicate && (
                            <Chip
                              size="small"
                              label="Duplicate"
                              color="warning"
                              variant="outlined"
                              sx={{
                                ml: 0.75,
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <Tooltip title="Insert gap here & shift subsequent sources down" arrow>
                            <IconButton
                              size="small"
                              aria-label={`Shift down from row ${idx + 1}`}
                              onClick={() => handleInsertGap(idx)}
                              sx={{
                                ml: 0.5,
                                p: 0.4,
                                color: 'text.secondary',
                                '&:hover': { color: '#38BDF8' },
                              }}
                            >
                              <MoveDown sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Paper>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          variant="contained"
          color="error"
          onClick={onStop}
          disabled={stopping}
          sx={{
            fontWeight: 700,
            bgcolor: 'error.main',
            color: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(244, 63, 94, 0.35)',
            '&:hover': { bgcolor: 'error.dark' },
          }}
        >
          {stopping ? 'Stopping...' : 'Stop task'}
        </Button>
        <Button onClick={onCancel} color="error">
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(excludedTargets)}
          variant="contained"
          disabled={activePairsCount <= 0 && state.targets.length > 0}
        >
          Confirm Pairing
        </Button>
      </DialogActions>
    </Dialog>
  );
}
