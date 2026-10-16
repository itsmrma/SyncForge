import { useState, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  IconButton,
  Radio,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

const LANG_MAP = {
  it: { codes: ['it', 'ita', 'italian', 'italiano'], label: 'ITA' },
  en: { codes: ['en', 'eng', 'english'], label: 'ENG' },
  ja: { codes: ['ja', 'jpn', 'japanese'], label: 'JPN' },
  es: { codes: ['es', 'spa', 'spanish', 'español'], label: 'SPA' },
  fr: { codes: ['fr', 'fra', 'fre', 'french', 'français'], label: 'FRA' },
  de: { codes: ['de', 'deu', 'ger', 'german', 'deutsch'], label: 'DEU' },
  pt: { codes: ['pt', 'por', 'portuguese'], label: 'POR' },
  ru: { codes: ['ru', 'rus', 'russian'], label: 'RUS' },
  zh: { codes: ['zh', 'zho', 'chi', 'chinese'], label: 'ZHO' },
  ko: { codes: ['ko', 'kor', 'korean'], label: 'KOR' },
};

function getSystemLanguageInfo() {
  const raw =
    (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const short = raw.split(/[-_]/)[0].toLowerCase();
  return (
    LANG_MAP[short] || {
      codes: [short],
      label: short.toUpperCase(),
    }
  );
}

function trackMatchesLang(track, codes) {
  const props = track.properties || {};
  const lang = (props.language || '').toLowerCase();
  const name = (props.track_name || '').toLowerCase();
  return codes.some(
    (code) =>
      lang === code ||
      name.includes(code)
  );
}

export default function InputDialog({ request, onResolve, onStop, stopping }) {
  const {
    prompt,
    tracks = [],
    kind = 'text',
    allow_empty,
    allow_skip,
    context,
  } = request;
  const [selected, setSelected] = useState(
    kind === 'multiple' ? tracks.map((t) => t.id) : []
  );
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const sysLang = useMemo(() => getSystemLanguageInfo(), []);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter((track) => {
      const props = track.properties || {};
      const haystack = [
        `id ${track.id}`,
        String(track.id),
        track.type || '',
        track.codec || '',
        props.language || 'und',
        props.track_name || '',
        props.default_track ? 'default' : '',
        props.forced_track ? 'forced' : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [tracks, searchQuery]);

  const resolve = async (value) => {
    if (submitting || stopping) return;
    setSubmitting(true);
    try {
      await onResolve(value);
    } catch (failure) {
      setError(failure.message || String(failure));
      setSubmitting(false);
    }
  };

  const toggle = (id) =>
    setSelected((prev) =>
      kind === 'single'
        ? [id]
        : prev.includes(id)
          ? prev.filter((value) => value !== id)
          : [...prev, id]
    );

  const selectOnlySystemLang = () => {
    const matching = tracks
      .filter((t) => trackMatchesLang(t, sysLang.codes))
      .map((t) => t.id);
    setSelected(matching);
  };

  const selectOnlyOriginalLang = () => {
    const origCodes = [...LANG_MAP.ja.codes, ...LANG_MAP.en.codes];
    const matching = tracks
      .filter((t) => trackMatchesLang(t, origCodes))
      .map((t) => t.id);
    setSelected(matching);
  };

  const deselectCommentarySdh = () => {
    const pattern =
      /\b(commentary|commento|sdh|hearing impaired|non udenti|descriptions|descriptive)\b/i;
    setSelected((prev) =>
      prev.filter((id) => {
        const tr = tracks.find((t) => t.id === id);
        const name = tr?.properties?.track_name || '';
        return !pattern.test(name);
      })
    );
  };

  const confirm = () =>
    resolve(
      kind === 'text'
        ? text
        : kind === 'single'
          ? String(selected[0])
          : selected.length === tracks.length
            ? ''
            : selected.length
              ? selected.join(',')
              : 'n'
    );

  return (
    <Dialog
      open
      onClose={() => resolve(null)}
      maxWidth="md"
      fullWidth
      aria-labelledby="input-title"
    >
      <DialogTitle id="input-title" sx={{ pb: 1, fontWeight: 700 }}>
        {prompt}
        {context && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: '0.8rem' }}
          >
            {context}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(148, 163, 184, 0.12)' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {(kind === 'multiple' || kind === 'single') && (
          <>
            <Typography color="text.secondary" variant="body2" sx={{ mb: 1.5 }}>
              {kind === 'multiple'
                ? 'Select the tracks to keep. The ID shown here is the MKVToolNix track ID.'
                : 'Select one track. The ID shown here is the MKVToolNix track ID.'}
            </Typography>
            {tracks.length > 0 && (
              <TextField
                size="small"
                fullWidth
                placeholder="Filter tracks by language, name, codec, or ID..."
                aria-label="Filter tracks"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ mb: 1.5 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label="Clear track filter"
                          onClick={() => setSearchQuery('')}
                          edge="end"
                        >
                          <ClearIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
              />
            )}
            {kind === 'multiple' && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  mb: 1.5,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelected(tracks.map((t) => t.id))}
                  disabled={submitting || stopping}
                >
                  Select all
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelected([])}
                  disabled={submitting || stopping}
                >
                  Select none
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={selectOnlySystemLang}
                  disabled={submitting || stopping}
                >
                  Only {sysLang.label}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={selectOnlyOriginalLang}
                  disabled={submitting || stopping}
                >
                  Only Original (JPN/ENG)
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={deselectCommentarySdh}
                  disabled={submitting || stopping}
                >
                  No Commentary/SDH
                </Button>
                <Chip
                  size="small"
                  label={`${selected.length} selected`}
                  sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                />
              </Box>
            )}
            {!tracks.length && (
              <Alert severity="info">
                No tracks of this type. Continue to leave them unchanged.
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredTracks.map((track) => {
                const properties = track.properties || {};
                const checked = selected.includes(track.id);
                const Control = kind === 'multiple' ? Checkbox : Radio;
                return (
                  <Box
                    component="label"
                    key={track.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.25,
                      border: '1px solid',
                      borderColor: checked
                        ? 'primary.main'
                        : 'rgba(148, 163, 184, 0.14)',
                      bgcolor: checked
                        ? 'rgba(99, 102, 241, 0.12)'
                        : '#0B0F18',
                      borderRadius: 2,
                      cursor: 'pointer',
                      minWidth: 0,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <Control
                      size="small"
                      checked={checked}
                      onChange={() => toggle(track.id)}
                      disabled={submitting || stopping}
                      slotProps={{
                        input: { 'aria-label': `Select track ID ${track.id}` },
                      }}
                    />
                    <Chip
                      label={`ID ${track.id}`}
                      color="primary"
                      size="small"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        minWidth: 68,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
                      <Typography fontWeight={700} fontSize="0.92rem">
                        {properties.track_name ||
                          (track.type === 'audio'
                            ? 'Audio track'
                            : 'Subtitle track')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" fontSize="0.8rem">
                        {track.type === 'audio' ? 'Audio' : 'Subtitles'} ·{' '}
                        {(properties.language || 'und').toUpperCase()} ·{' '}
                        {track.codec || 'Unknown codec'}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 0.5,
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {properties.default_track && (
                        <Chip label="Default" size="small" variant="outlined" />
                      )}
                      {properties.forced_track && (
                        <Chip label="Forced" size="small" variant="outlined" />
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </>
        )}
        {kind === 'confirm' && (
          <Typography color="text.secondary">
            Choose Yes or No to continue.
          </Typography>
        )}
        {kind === 'text' && (
          <TextField
            autoFocus
            fullWidth
            label="Your answer"
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={submitting || stopping}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirm();
            }}
            sx={{ mt: 1 }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onStop} color="error" disabled={stopping}>
          {stopping ? 'Stopping...' : 'Stop task'}
        </Button>
        <Box sx={{ flex: 1 }} />
        {allow_skip && (
          <Button
            variant="outlined"
            onClick={() => resolve('s')}
            disabled={submitting || stopping}
          >
            Skip group
          </Button>
        )}
        {allow_empty && (
          <Button
            variant="outlined"
            onClick={() => resolve('')}
            disabled={submitting || stopping}
          >
            Leave unchanged
          </Button>
        )}
        {kind === 'confirm' ? (
          <>
            <Button
              variant="outlined"
              onClick={() => resolve('n')}
              disabled={submitting || stopping}
            >
              No
            </Button>
            <Button
              variant="contained"
              onClick={() => resolve('y')}
              disabled={submitting || stopping}
            >
              Yes
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            onClick={confirm}
            disabled={
              submitting ||
              stopping ||
              (kind === 'single' && !selected.length)
            }
          >
            {kind === 'text' ? 'Continue' : 'Confirm selection'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
