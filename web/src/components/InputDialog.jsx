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
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import SubtitlesOutlined from '@mui/icons-material/SubtitlesOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import AudiotrackOutlined from '@mui/icons-material/AudiotrackOutlined';
import StarBorder from '@mui/icons-material/StarBorder';
import PushPinOutlined from '@mui/icons-material/PushPinOutlined';
import SwapHoriz from '@mui/icons-material/SwapHoriz';
import ArrowForward from '@mui/icons-material/ArrowForward';

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
  const lang = (props.language || '').toLowerCase().trim();
  const langIetf = (props.language_ietf || '').toLowerCase().trim();
  const name = (props.track_name || '').toLowerCase();

  return codes.some((code) => {
    const c = code.toLowerCase();
    // 1. Exact or prefix match on ISO / IETF language code (e.g. "eng", "en", "en-us")
    if (lang === c || lang.startsWith(`${c}-`)) return true;
    if (langIetf === c || langIetf.startsWith(`${c}-`)) return true;

    // 2. Word-boundary regex on track name so "French" never matches "en"
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
    return wordRegex.test(name);
  });
}

function getFileName(filePath) {
  if (!filePath) return '';
  return filePath.split(/[\\/]/).pop();
}

export default function InputDialog({ request, onResolve, onStop, stopping }) {
  const {
    prompt,
    tracks = [],
    kind = 'text',
    allow_empty,
    allow_skip,
    context,
    files = [],
  } = request;
  const [selected, setSelected] = useState(
    kind === 'multiple' ? tracks.map((t) => t.id) : []
  );
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFiles, setShowFiles] = useState(false);
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

  const audioTracks = useMemo(
    () => filteredTracks.filter((t) => t.type === 'audio'),
    [filteredTracks]
  );
  const subtitleTracks = useMemo(
    () => filteredTracks.filter((t) => t.type === 'subtitles'),
    [filteredTracks]
  );
  const otherTracks = useMemo(
    () => filteredTracks.filter((t) => t.type !== 'audio' && t.type !== 'subtitles'),
    [filteredTracks]
  );

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

  const detectedLanguages = useMemo(() => {
    const map = new Map();
    for (const track of tracks) {
      const props = track.properties || {};
      const lang = (props.language || '').toLowerCase().trim();
      const langIetf = (props.language_ietf || '').toLowerCase().trim();
      const codeToTest = langIetf || lang;
      if (codeToTest && codeToTest !== 'und') {
        const found = Object.values(LANG_MAP).find((item) =>
          item.codes.some((c) => codeToTest === c || codeToTest.startsWith(`${c}-`))
        );
        const label = found ? found.label : codeToTest.slice(0, 3).toUpperCase();
        const codes = found ? found.codes : [codeToTest];
        if (!map.has(label)) {
          map.set(label, { label, codes });
        }
      }
    }
    return Array.from(map.values());
  }, [tracks]);

  const hasDefaultTracks = useMemo(
    () => tracks.some((t) => t.properties?.default_track),
    [tracks]
  );

  const selectOnlyDefault = () => {
    const matching = tracks
      .filter((t) => t.properties?.default_track)
      .map((t) => t.id);
    if (matching.length > 0) {
      setSelected(matching);
    }
  };

  const selectOnlyLang = (codes) => {
    const matching = tracks
      .filter((t) => trackMatchesLang(t, codes))
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

  const invertSelection = () => {
    setSelected((prev) => {
      const current = new Set(prev);
      return tracks.filter((t) => !current.has(t.id)).map((t) => t.id);
    });
  };

  const selectSystemPlusOriginal = () => {
    const firstAudio =
      tracks.find((t) => t.type === 'audio' && t.properties?.default_track) ||
      tracks.find((t) => t.type === 'audio') ||
      tracks[0];
    const origLang = (
      firstAudio?.properties?.language_ietf ||
      firstAudio?.properties?.language ||
      ''
    )
      .toLowerCase()
      .trim();
    const origEntry = Object.values(LANG_MAP).find((item) =>
      item.codes.some((c) => origLang === c || origLang.startsWith(`${c}-`))
    );
    const origCodes = origEntry
      ? origEntry.codes
      : origLang && origLang !== 'und'
        ? [origLang]
        : ['jpn', 'ja', 'eng', 'en'];
    const combinedCodes = Array.from(new Set([...sysLang.codes, ...origCodes]));
    const matching = tracks
      .filter(
        (t) =>
          trackMatchesLang(t, combinedCodes) ||
          (firstAudio && t.id === firstAudio.id)
      )
      .map((t) => t.id);
    setSelected(matching);
  };

  const selectAllAudio = () => {
    const audioIds = new Set(audioTracks.map((t) => t.id));
    setSelected((prev) => Array.from(new Set([...prev, ...audioIds])));
  };

  const deselectAllAudio = () => {
    const audioIds = new Set(audioTracks.map((t) => t.id));
    setSelected((prev) => prev.filter((id) => !audioIds.has(id)));
  };

  const selectAllSubs = () => {
    const subIds = new Set(subtitleTracks.map((t) => t.id));
    setSelected((prev) => Array.from(new Set([...prev, ...subIds])));
  };

  const deselectAllSubs = () => {
    const subIds = new Set(subtitleTracks.map((t) => t.id));
    setSelected((prev) => prev.filter((id) => !subIds.has(id)));
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

  const renderTrackItem = (track, isAudio) => {
    const properties = track.properties || {};
    const checked = selected.includes(track.id);
    const Control = kind === 'multiple' ? Checkbox : Radio;
    const langCode = (properties.language || 'und').toUpperCase();
    const trackName =
      properties.track_name || (isAudio ? 'Audio track' : 'Subtitle track');

    return (
      <Box
        component="label"
        key={track.id}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.25,
          border: '1.5px solid',
          borderColor: checked
            ? isAudio
              ? '#34D399'
              : '#38BDF8'
            : 'rgba(148, 163, 184, 0.14)',
          bgcolor: checked
            ? isAudio
              ? 'rgba(52, 211, 153, 0.10)'
              : 'rgba(56, 189, 248, 0.10)'
            : '#0B0F18',
          borderRadius: 2,
          cursor: 'pointer',
          minWidth: 0,
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: isAudio
              ? 'rgba(52, 211, 153, 0.6)'
              : 'rgba(56, 189, 248, 0.6)',
            bgcolor: checked
              ? isAudio
                ? 'rgba(52, 211, 153, 0.14)'
                : 'rgba(56, 189, 248, 0.14)'
              : 'rgba(255, 255, 255, 0.03)',
          },
        }}
      >
        <Control
          size="small"
          checked={checked}
          onChange={() => toggle(track.id)}
          disabled={submitting || stopping}
          sx={{
            color: isAudio
              ? 'rgba(52, 211, 153, 0.6)'
              : 'rgba(56, 189, 248, 0.6)',
            '&.Mui-checked': {
              color: isAudio ? '#34D399' : '#38BDF8',
            },
          }}
          slotProps={{
            input: { 'aria-label': `Select track ID ${track.id}` },
          }}
        />
        <Chip
          label={`ID ${track.id}`}
          size="small"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            fontWeight: 800,
            minWidth: 64,
            flexShrink: 0,
            bgcolor: checked
              ? isAudio
                ? 'rgba(52, 211, 153, 0.22)'
                : 'rgba(56, 189, 248, 0.22)'
              : 'rgba(99, 102, 241, 0.16)',
            color: checked
              ? isAudio
                ? '#34D399'
                : '#38BDF8'
              : '#A5B4FC',
            border: '1px solid',
            borderColor: checked
              ? isAudio
                ? 'rgba(52, 211, 153, 0.45)'
                : 'rgba(56, 189, 248, 0.45)'
              : 'rgba(99, 102, 241, 0.3)',
          }}
        />
        <Box sx={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography fontWeight={700} fontSize="0.92rem">
              {trackName}
            </Typography>
            <Chip
              label={isAudio ? 'Audio' : 'Subtitles'}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                bgcolor: isAudio
                  ? 'rgba(52, 211, 153, 0.12)'
                  : 'rgba(56, 189, 248, 0.12)',
                color: isAudio ? '#34D399' : '#38BDF8',
                border: '1px solid',
                borderColor: isAudio
                  ? 'rgba(52, 211, 153, 0.3)'
                  : 'rgba(56, 189, 248, 0.3)',
              }}
            />
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            fontSize="0.8rem"
            sx={{ mt: 0.25 }}
          >
            {isAudio ? 'Audio' : 'Subtitles'} · {langCode} ·{' '}
            {track.codec || 'Unknown codec'}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          {properties.default_track && (
            <Chip
              icon={<StarBorder sx={{ fontSize: 14, color: '#A5B4FC !important' }} />}
              label="Default"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 700,
                bgcolor: 'rgba(99, 102, 241, 0.20)',
                color: '#A5B4FC',
                border: '1px solid rgba(99, 102, 241, 0.55)',
              }}
            />
          )}
          {properties.forced_track && (
            <Chip
              icon={<PushPinOutlined sx={{ fontSize: 14, color: '#FBBF24 !important' }} />}
              label="Forced"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 700,
                bgcolor: 'rgba(245, 158, 11, 0.20)',
                color: '#FBBF24',
                border: '1px solid rgba(245, 158, 11, 0.55)',
              }}
            />
          )}
        </Box>
      </Box>
    );
  };

  const isOpusConfirm =
    kind === 'confirm' &&
    (prompt.toLowerCase().includes('opus') || tracks.length > 0);

  return (
    <Dialog
      open
      onClose={() => resolve(null)}
      maxWidth="md"
      fullWidth
      aria-labelledby="input-title"
    >
      <DialogTitle id="input-title" sx={{ pb: 1.5, fontWeight: 700 }}>
        <Typography variant="h5" component="div" fontWeight={700}>
          {prompt}
        </Typography>
        {(context || (files && files.length > 0)) && (
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {context && (
                <Chip
                  size="small"
                  label={context}
                  color="secondary"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.76rem' }}
                />
              )}
              {files && files.length > 1 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowFiles((prev) => !prev)}
                  startIcon={<FolderOpenOutlined fontSize="small" />}
                  sx={{ fontSize: '0.75rem', py: 0.25, px: 0.75, minHeight: 0 }}
                >
                  {showFiles ? 'Hide files in this group' : `Show all ${files.length} files`}
                </Button>
              )}
            </Box>
            {files && files.length === 1 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(148, 163, 184, 0.08)',
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                }}
              >
                <InsertDriveFileOutlined sx={{ fontSize: 16, color: '#818CF8', flexShrink: 0 }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    color: 'text.primary',
                    fontSize: '0.78rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {getFileName(files[0])}
                </Typography>
              </Box>
            )}
            {files && files.length > 1 && showFiles && (
              <Box
                sx={{
                  maxHeight: 140,
                  overflowY: 'auto',
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(148, 163, 184, 0.06)',
                  border: '1px solid rgba(148, 163, 184, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                {files.map((file, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 20 }}>
                      {idx + 1}.
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'monospace',
                        color: 'text.primary',
                        fontSize: '0.75rem',
                        wordBreak: 'break-all',
                      }}
                    >
                      {getFileName(file)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
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
                  mb: 2,
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
                  startIcon={<SwapHoriz fontSize="small" />}
                  onClick={invertSelection}
                  disabled={submitting || stopping}
                >
                  Invert selection
                </Button>
                {hasDefaultTracks && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={selectOnlyDefault}
                    disabled={submitting || stopping}
                  >
                    Only Default
                  </Button>
                )}
                {detectedLanguages.length > 1 && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={selectSystemPlusOriginal}
                    disabled={submitting || stopping}
                  >
                    System + Original
                  </Button>
                )}
                {detectedLanguages.length > 0 ? (
                  detectedLanguages.map((l) => (
                    <Button
                      key={l.label}
                      size="small"
                      variant="outlined"
                      onClick={() => selectOnlyLang(l.codes)}
                      disabled={submitting || stopping}
                    >
                      Only {l.label}
                    </Button>
                  ))
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => selectOnlyLang(sysLang.codes)}
                    disabled={submitting || stopping}
                  >
                    Only {sysLang.label}
                  </Button>
                )}
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

            {/* Audio Tracks Section */}
            {audioTracks.length > 0 && (
              <Box sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                    px: 0.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HeadphonesOutlined sx={{ color: '#34D399', fontSize: 19 }} />
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: '#34D399',
                        textTransform: 'uppercase',
                        fontSize: '0.78rem',
                      }}
                    >
                      Audio Tracks ({audioTracks.length})
                    </Typography>
                  </Box>
                  {kind === 'multiple' && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        size="small"
                        onClick={selectAllAudio}
                        sx={{ fontSize: '0.7rem', py: 0.1, px: 0.75, minHeight: 0 }}
                      >
                        All Audio
                      </Button>
                      <Button
                        size="small"
                        onClick={deselectAllAudio}
                        color="inherit"
                        sx={{ fontSize: '0.7rem', py: 0.1, px: 0.75, minHeight: 0, color: 'text.secondary' }}
                      >
                        None
                      </Button>
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {audioTracks.map((t) => renderTrackItem(t, true))}
                </Box>
              </Box>
            )}

            {/* Subtitles Section */}
            {subtitleTracks.length > 0 && (
              <Box sx={{ mb: 2.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                    px: 0.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SubtitlesOutlined sx={{ color: '#38BDF8', fontSize: 19 }} />
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: '#38BDF8',
                        textTransform: 'uppercase',
                        fontSize: '0.78rem',
                      }}
                    >
                      Subtitle Tracks ({subtitleTracks.length})
                    </Typography>
                  </Box>
                  {kind === 'multiple' && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        size="small"
                        onClick={selectAllSubs}
                        sx={{ fontSize: '0.7rem', py: 0.1, px: 0.75, minHeight: 0 }}
                      >
                        All Subs
                      </Button>
                      <Button
                        size="small"
                        onClick={deselectAllSubs}
                        color="inherit"
                        sx={{ fontSize: '0.7rem', py: 0.1, px: 0.75, minHeight: 0, color: 'text.secondary' }}
                      >
                        None
                      </Button>
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {subtitleTracks.map((t) => renderTrackItem(t, false))}
                </Box>
              </Box>
            )}

            {/* Other Tracks Section */}
            {otherTracks.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    fontSize: '0.78rem',
                    mb: 1,
                    px: 0.5,
                  }}
                >
                  Other Tracks ({otherTracks.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {otherTracks.map((t) => renderTrackItem(t, false))}
                </Box>
              </Box>
            )}
          </>
        )}
        {kind === 'confirm' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
            {isOpusConfirm ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(99, 102, 241, 0.18)',
                      color: '#818CF8',
                      flexShrink: 0,
                    }}
                  >
                    <AudiotrackOutlined />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Audio Re-encoding: Opus
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Re-encodes kept audio tracks with libopus (VBR). Video and subtitles remain 100% untouched and lossless.
                    </Typography>
                  </Box>
                </Box>

                {tracks && tracks.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Audio tracks to be converted ({tracks.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.75 }}>
                      {tracks.map((t) => (
                        <Box
                          key={t.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            p: 1.25,
                            borderRadius: 1.5,
                            bgcolor: 'rgba(15, 20, 31, 0.8)',
                            border: '1px solid rgba(148, 163, 184, 0.12)',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Chip label={`ID ${t.id}`} size="small" sx={{ fontFamily: 'monospace', fontWeight: 700 }} />
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {t.properties?.track_name || 'Audio track'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              ({(t.properties?.language || 'und').toUpperCase()} · {t.codec || 'Unknown'})
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: '#34D399',
                              fontWeight: 700,
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <ArrowForward sx={{ fontSize: 13 }} />
                            Opus 128k
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : (
              <Typography color="text.secondary">
                Choose Yes or No to continue.
              </Typography>
            )}
          </Box>
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
