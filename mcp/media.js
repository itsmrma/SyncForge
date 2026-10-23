import { VERSION } from './version.js';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

// Search directories across platforms (mirroring SyncForge Rust core/processes.rs)
const SEARCH_PATHS = (() => {
  const list = [];
  const envPath = (process.env.PATH || '').split(path.delimiter);
  list.push(...envPath);

  if (process.platform === 'darwin') {
    list.push(
      '/Applications/MKVToolNix.app/Contents/MacOS',
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
      '/usr/bin',
      '/bin'
    );
  } else if (process.platform === 'win32') {
    const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || '';
    list.push(
      path.join(progFiles, 'MKVToolNix'),
      path.join(progFilesX86, 'MKVToolNix'),
      path.join(progFiles, 'ffmpeg', 'bin'),
      path.join(localAppData, 'Programs', 'Python', 'Python310', 'Scripts'),
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts'),
      path.join(localAppData, 'Programs', 'Python', 'Python312', 'Scripts'),
      'C:\\ffmpeg\\bin'
    );
  } else {
    // Linux
    list.push(
      '/usr/bin',
      '/usr/local/bin',
      '/opt/mkvtoolnix/bin',
      '/snap/bin'
    );
  }

  // Deduplicate and filter existing directories
  const seen = new Set();
  const valid = [];
  for (const dir of list) {
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    try {
      if (fs.existsSync(dir)) valid.push(dir);
    } catch {}
  }
  return valid;
})();

const BINARY_CACHE = new Map();

/**
 * Locate a binary across known search paths and system PATH.
 */
export function findBinary(name) {
  if (BINARY_CACHE.has(name)) {
    return BINARY_CACHE.get(name);
  }

  const isWin = process.platform === 'win32';
  const exts = isWin ? ['.exe', '.cmd', '.bat', ''] : [''];

  for (const dir of SEARCH_PATHS) {
    for (const ext of exts) {
      const fullPath = path.join(dir, isWin && !name.toLowerCase().endsWith(ext) ? `${name}${ext}` : name);
      try {
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            BINARY_CACHE.set(name, fullPath);
            return fullPath;
          }
        }
      } catch {}
    }
  }

  BINARY_CACHE.set(name, null);
  return null;
}

/**
 * Check dependencies and tool availability.
 */
export async function getSystemHealth() {
  const tools = ['mkvmerge', 'mkvextract', 'mkvpropedit', 'ffmpeg', 'ffprobe', 'ffsubsync', 'mpv'];
  const results = {};

  const installInstructions = {
    mkvmerge: process.platform === 'darwin' ? 'brew install mkvtoolnix' : 'sudo apt install mkvtoolnix',
    mkvextract: process.platform === 'darwin' ? 'brew install mkvtoolnix' : 'sudo apt install mkvtoolnix',
    mkvpropedit: process.platform === 'darwin' ? 'brew install mkvtoolnix' : 'sudo apt install mkvtoolnix',
    ffmpeg: process.platform === 'darwin' ? 'brew install ffmpeg' : 'sudo apt install ffmpeg',
    ffprobe: process.platform === 'darwin' ? 'brew install ffmpeg' : 'sudo apt install ffmpeg',
    ffsubsync: 'pip install ffsubsync',
    mpv: process.platform === 'darwin' ? 'brew install mpv' : 'sudo apt install mpv',
  };

  for (const tool of tools) {
    const binPath = findBinary(tool);
    if (!binPath) {
      results[tool] = {
        found: false,
        path: null,
        version: null,
        install_command: installInstructions[tool] || null,
      };
      continue;
    }

    let version = null;
    try {
      let args = ['--version'];
      if (tool === 'ffsubsync') args = ['--version'];
      else if (tool === 'ffmpeg' || tool === 'ffprobe') args = ['-version'];

      const { stdout } = await execFileAsync(binPath, args, { timeout: 3000 });
      const firstLine = stdout.split('\n')[0].trim();
      version = firstLine;
    } catch (e) {
      version = 'detected';
    }

    results[tool] = {
      found: true,
      path: binPath,
      version,
      install_command: null,
    };
  }

  return {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    platform: process.platform,
    syncforge_version: VERSION,
    tools: results,
  };
}

/**
 * Recursively find files with given extensions.
 */
export function getFilesRecursive(dir, extensions) {
  const results = [];
  const cleanExts = extensions.map(e => e.toLowerCase().replace(/^\./, ''));

  function scan(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '');
        if (cleanExts.includes(ext)) {
          results.push(full);
        }
      }
    }
  }

  scan(dir);
  return results.sort();
}

/**
 * Inspect media file or folder structure.
 */
export async function inspectMedia(targetPath) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Path does not exist: ${targetPath}`);
  }

  const stat = fs.statSync(targetPath);

  if (stat.isDirectory()) {
    const videoExts = ['mkv', 'mp4', 'avi', 'mov', 'webm', 'm4v'];
    const subExts = ['srt', 'ass', 'ssa', 'vtt'];
    const videos = getFilesRecursive(targetPath, videoExts);
    const subs = getFilesRecursive(targetPath, subExts);

    let sampleTracks = [];
    if (videos.length > 0) {
      const firstMkv = videos.find(v => v.toLowerCase().endsWith('.mkv')) || videos[0];
      try {
        const firstInspect = await inspectMediaFile(firstMkv);
        sampleTracks = firstInspect.tracks || [];
      } catch {}
    }

    return {
      kind: 'folder',
      path: targetPath,
      name: path.basename(targetPath),
      video_count: videos.length,
      sub_count: subs.length,
      sample_file: videos[0] || null,
      sample_tracks: sampleTracks,
      videos_sample: videos.slice(0, 10),
      subs_sample: subs.slice(0, 10),
    };
  }

  return inspectMediaFile(targetPath);
}

/**
 * Deep inspection of a single media file.
 */
async function inspectMediaFile(filePath) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mkvmerge = findBinary('mkvmerge');

  // If MKV and mkvmerge is available, use mkvmerge -J for native track IDs and tags
  if (ext === '.mkv' && mkvmerge) {
    try {
      const { stdout } = await execFileAsync(mkvmerge, ['-J', filePath]);
      const data = JSON.parse(stdout);

      const tracks = (data.tracks || []).map(t => ({
        id: t.id,
        type: t.type,
        codec: t.codec,
        language: t.properties?.language || 'und',
        language_ietf: t.properties?.language_ietf || null,
        title: t.properties?.track_name || null,
        default: Boolean(t.properties?.default_track),
        forced: Boolean(t.properties?.forced_track),
        channels: t.properties?.audio_channels || null,
        sampling_frequency: t.properties?.audio_sampling_frequency || null,
        pixel_dimensions: t.properties?.pixel_dimensions || null,
      }));

      const attachments = (data.attachments || []).map(a => ({
        id: a.id,
        filename: a.file_name,
        mime_type: a.content_type,
        size_bytes: a.size,
      }));

      return {
        kind: 'file',
        container: 'MKV',
        path: filePath,
        filename: path.basename(filePath),
        size_bytes: stat.size,
        size_mb: Number((stat.size / (1024 * 1024)).toFixed(2)),
        tracks,
        attachments_count: attachments.length,
        attachments,
      };
    } catch {}
  }

  // Fallback to ffprobe if available
  const ffprobe = findBinary('ffprobe');
  if (ffprobe) {
    try {
      const { stdout } = await execFileAsync(ffprobe, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);
      const data = JSON.parse(stdout);

      const tracks = (data.streams || []).map(s => {
        const type = s.codec_type === 'audio' ? 'audio' : s.codec_type === 'video' ? 'video' : s.codec_type === 'subtitle' ? 'subtitles' : s.codec_type;
        return {
          id: s.index,
          type,
          codec: s.codec_name,
          language: s.tags?.language || 'und',
          title: s.tags?.title || null,
          default: Boolean(s.disposition?.default),
          forced: Boolean(s.disposition?.forced),
          channels: s.channels || null,
          sampling_frequency: s.sample_rate ? Number(s.sample_rate) : null,
          pixel_dimensions: s.width && s.height ? `${s.width}x${s.height}` : null,
        };
      });

      return {
        kind: 'file',
        container: ext.replace(/^\./, '').toUpperCase(),
        path: filePath,
        filename: path.basename(filePath),
        size_bytes: stat.size,
        size_mb: Number((stat.size / (1024 * 1024)).toFixed(2)),
        duration_seconds: data.format?.duration ? Number(data.format.duration) : null,
        tracks,
      };
    } catch {}
  }

  return {
    kind: 'file',
    container: ext.replace(/^\./, '').toUpperCase(),
    path: filePath,
    filename: path.basename(filePath),
    size_bytes: stat.size,
    size_mb: Number((stat.size / (1024 * 1024)).toFixed(2)),
    tracks: [],
    warning: 'Neither mkvmerge nor ffprobe could be found to inspect track details.',
  };
}

/**
 * Read standard 16-bit PCM WAV samples into a Float32Array.
 */
function readWavSamples(wavPath) {
  const buf = fs.readFileSync(wavPath);
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Invalid WAV file');
  }

  let offset = 12;
  let sampleRate = 8000;
  let channels = 1;
  let bitsPerSample = 16;
  let dataOffset = 44;
  let dataLength = 0;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bits per sample: ${bitsPerSample}`);
  }

  const sampleCount = Math.floor(dataLength / (2 * channels));
  const samples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const idx = dataOffset + (i * channels + c) * 2;
      if (idx + 1 < buf.length) {
        sum += buf.readInt16LE(idx);
      }
    }
    samples[i] = sum / channels;
  }

  return { sampleRate, samples };
}

/**
 * Cross-correlation delay calculation between two media files.
 */
export async function calculateAudioDelay(refMedia, srcMedia, startTime = '00:02:00', duration = '00:03:00') {
  const ffmpeg = findBinary('ffmpeg');
  if (!ffmpeg) {
    throw new Error('ffmpeg is required for audio waveform extraction but was not found.');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncforge-delay-'));
  const refWav = path.join(tempDir, 'ref.wav');
  const srcWav = path.join(tempDir, 'src.wav');

  try {
    // Extract 8000 Hz mono 16-bit PCM wav segments
    await execFileAsync(ffmpeg, [
      '-y', '-ss', startTime, '-t', duration,
      '-i', refMedia,
      '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le',
      refWav
    ]);

    await execFileAsync(ffmpeg, [
      '-y', '-ss', startTime, '-t', duration,
      '-i', srcMedia,
      '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le',
      srcWav
    ]);

    const ref = readWavSamples(refWav);
    const src = readWavSamples(srcWav);

    const fsRate = ref.sampleRate;
    const maxDelaySeconds = 60; // +/- 60 seconds
    const maxLagSamples = maxDelaySeconds * fsRate;

    // Normalize
    let meanRef = 0;
    for (let i = 0; i < ref.samples.length; i++) meanRef += ref.samples[i];
    meanRef /= ref.samples.length || 1;

    let varRef = 0;
    for (let i = 0; i < ref.samples.length; i++) {
      const diff = ref.samples[i] - meanRef;
      varRef += diff * diff;
    }
    const stdRef = Math.sqrt(varRef / (ref.samples.length || 1)) || 1;

    let meanSrc = 0;
    for (let i = 0; i < src.samples.length; i++) meanSrc += src.samples[i];
    meanSrc /= src.samples.length || 1;

    let varSrc = 0;
    for (let i = 0; i < src.samples.length; i++) {
      const diff = src.samples[i] - meanSrc;
      varSrc += diff * diff;
    }
    const stdSrc = Math.sqrt(varSrc / (src.samples.length || 1)) || 1;

    // Cross-correlation over decimated audio for fast search, then refined
    const step = 4; // Downsample 8000 Hz to 2000 Hz for rough search
    const nRef = Math.floor(ref.samples.length / step);
    const nSrc = Math.floor(src.samples.length / step);
    const subRef = new Float32Array(nRef);
    const subSrc = new Float32Array(nSrc);

    for (let i = 0; i < nRef; i++) subRef[i] = (ref.samples[i * step] - meanRef) / stdRef;
    for (let i = 0; i < nSrc; i++) subSrc[i] = (src.samples[i * step] - meanSrc) / stdSrc;

    const maxSubLag = Math.floor(maxLagSamples / step);
    let bestScore = -Infinity;
    let bestSubLag = 0;

    for (let lag = -maxSubLag; lag <= maxSubLag; lag++) {
      let score = 0;
      let count = 0;
      const startRef = Math.max(0, lag);
      const endRef = Math.min(nRef, nSrc + lag);

      for (let r = startRef; r < endRef; r += 2) {
        const s = r - lag;
        score += subRef[r] * subSrc[s];
        count++;
      }
      if (count > 0) score /= count;

      if (score > bestScore) {
        bestScore = score;
        bestSubLag = lag;
      }
    }

    // Refine around bestSubLag at full resolution
    const roughSampleLag = bestSubLag * step;
    const refineRadius = step * 2;
    let fineBestLag = roughSampleLag;
    let fineBestScore = -Infinity;

    for (let lag = roughSampleLag - refineRadius; lag <= roughSampleLag + refineRadius; lag++) {
      let score = 0;
      let count = 0;
      const startRef = Math.max(0, lag);
      const endRef = Math.min(ref.samples.length, src.samples.length + lag);

      for (let r = startRef; r < endRef; r += 2) {
        const s = r - lag;
        score += ((ref.samples[r] - meanRef) / stdRef) * ((src.samples[s] - meanSrc) / stdSrc);
        count++;
      }
      if (count > 0) score /= count;

      if (score > fineBestScore) {
        fineBestScore = score;
        fineBestLag = lag;
      }
    }

    const delayMs = Math.round((fineBestLag / fsRate) * 1000);

    return {
      delay_ms: delayMs,
      delay_seconds: Number((delayMs / 1000).toFixed(3)),
      confidence_score: Number(fineBestScore.toFixed(4)),
      reference: refMedia,
      source: srcMedia,
      segment_analyzed: `${startTime} + ${duration}`,
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Synchronize external subtitle file to video using ffsubsync.
 */
export async function syncSubtitles(referenceVideo, subtitleFile, outputFile, maxOffsetSeconds = null) {
  const ffsubsync = findBinary('ffsubsync');
  if (!ffsubsync) {
    throw new Error('ffsubsync is not installed or not found. Install with: pip install ffsubsync');
  }

  const args = [referenceVideo, '-i', subtitleFile, '-o', outputFile];
  if (maxOffsetSeconds && maxOffsetSeconds > 0) {
    args.push('--max-offset-seconds', String(maxOffsetSeconds));
  }

  const { stdout, stderr } = await execFileAsync(ffsubsync, args);
  return {
    status: 'ok',
    output_file: outputFile,
    log: `${stdout}\n${stderr}`.trim(),
  };
}

/**
 * Set Default and Forced track flags in an MKV file directly using mkvpropedit.
 */
export async function setTrackFlags(mkvFile, options) {
  const mkvpropedit = findBinary('mkvpropedit');
  if (!mkvpropedit) {
    throw new Error('mkvpropedit (MKVToolNix) is not installed or not found.');
  }

  const args = [mkvFile];

  if (options.default_audio_id !== undefined) {
    args.push('--edit', `track:${options.default_audio_id}`, '--set', 'flag-default=1');
  }
  if (options.forced_audio_id !== undefined) {
    args.push('--edit', `track:${options.forced_audio_id}`, '--set', 'flag-forced=1');
  }
  if (options.default_sub_id !== undefined) {
    args.push('--edit', `track:${options.default_sub_id}`, '--set', 'flag-default=1');
  }
  if (options.forced_sub_id !== undefined) {
    args.push('--edit', `track:${options.forced_sub_id}`, '--set', 'flag-forced=1');
  }

  if (options.clear_other_defaults) {
    // If clearing others, inspect file first and turn off other defaults
    const info = await inspectMedia(mkvFile);
    if (options.default_audio_id !== undefined) {
      for (const t of info.tracks.filter(t => t.type === 'audio' && t.id !== options.default_audio_id)) {
        args.push('--edit', `track:${t.id}`, '--set', 'flag-default=0');
      }
    }
    if (options.default_sub_id !== undefined) {
      for (const t of info.tracks.filter(t => t.type === 'subtitles' && t.id !== options.default_sub_id)) {
        args.push('--edit', `track:${t.id}`, '--set', 'flag-default=0');
      }
    }
  }

  const { stdout, stderr } = await execFileAsync(mkvpropedit, args);
  return {
    status: 'ok',
    file: mkvFile,
    log: `${stdout}\n${stderr}`.trim(),
  };
}

/**
 * Extract a track from an MKV file using mkvextract.
 */
export async function extractTrack(mkvFile, trackId, outputPath) {
  const mkvextract = findBinary('mkvextract');
  if (!mkvextract) {
    throw new Error('mkvextract (MKVToolNix) is not installed or not found.');
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const { stdout, stderr } = await execFileAsync(mkvextract, [
    mkvFile,
    'tracks',
    `${trackId}:${outputPath}`
  ]);

  return {
    status: 'ok',
    extracted_file: outputPath,
    log: `${stdout}\n${stderr}`.trim(),
  };
}

/**
 * Filter and remux tracks with optional Opus audio re-encoding.
 */
export async function filterAndCleanTracks(inputMkv, outputMkv, options = {}) {
  const mkvmerge = findBinary('mkvmerge');
  if (!mkvmerge) {
    throw new Error('mkvmerge (MKVToolNix) is not installed or not found.');
  }

  const outDir = path.dirname(outputMkv);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let audioIds = options.audio_ids;
  let subIds = options.sub_ids;

  if ((options.keep_audio !== undefined || options.keep_subs !== undefined) && (!audioIds || !subIds)) {
    try {
      const { stdout: jsonOut } = await execFileAsync(mkvmerge, ['-J', inputMkv]);
      const meta = JSON.parse(jsonOut);
      const allTracks = meta.tracks || [];

      if (options.keep_audio !== undefined && !audioIds) {
        const ka = String(options.keep_audio).trim().toLowerCase();
        if (ka === 'none' || ka === 'n') {
          audioIds = [];
        } else if (ka === 'all' || ka === '*') {
          audioIds = allTracks.filter(t => t.type === 'audio').map(t => t.id);
        } else {
          const tokens = ka.split(',').map(s => s.trim().toLowerCase());
          audioIds = allTracks
            .filter(t => {
              if (t.type !== 'audio') return false;
              const tid = String(t.id);
              const lang = (t.properties?.language || '').toLowerCase();
              const name = (t.properties?.track_name || '').toLowerCase();
              return tokens.some(tok => tok === tid || tok === lang || (tok === 'ita' && lang === 'it') || (tok === 'jpn' && (lang === 'ja' || lang === 'jp')) || name.includes(tok));
            })
            .map(t => t.id);
        }
      }

      if (options.keep_subs !== undefined && !subIds) {
        const ks = String(options.keep_subs).trim().toLowerCase();
        if (ks === 'none' || ks === 'n') {
          subIds = [];
        } else if (ks === 'all' || ks === '*') {
          subIds = allTracks.filter(t => t.type === 'subtitles').map(t => t.id);
        } else {
          const tokens = ks.split(',').map(s => s.trim().toLowerCase());
          subIds = allTracks
            .filter(t => {
              if (t.type !== 'subtitles') return false;
              const tid = String(t.id);
              const lang = (t.properties?.language || '').toLowerCase();
              const name = (t.properties?.track_name || '').toLowerCase();
              return tokens.some(tok => tok === tid || tok === lang || (tok === 'ita' && lang === 'it') || (tok === 'jpn' && (lang === 'ja' || lang === 'jp')) || name.includes(tok));
            })
            .map(t => t.id);
        }
      }
    } catch {}
  }

  const args = ['-o', outputMkv];

  if (options.video_ids && options.video_ids.length > 0) {
    args.push('-d', options.video_ids.join(','));
  }
  if (audioIds && audioIds.length > 0) {
    args.push('-a', audioIds.join(','));
  } else if (audioIds && audioIds.length === 0) {
    args.push('-A'); // No audio
  }

  if (subIds && subIds.length > 0) {
    args.push('-s', subIds.join(','));
  } else if (subIds && subIds.length === 0) {
    args.push('-S'); // No subtitles
  }

  args.push(inputMkv);

  const { stdout, stderr } = await execFileAsync(mkvmerge, args);
  return {
    status: 'ok',
    output_file: outputMkv,
    log: `${stdout}\n${stderr}`.trim(),
  };
}

/**
 * Merge tracks from target and source media files.
 */
export async function mergeTracks(targetVideo, sourceMedia, outputMkv, options = {}) {
  const mkvmerge = findBinary('mkvmerge');
  if (!mkvmerge) {
    throw new Error('mkvmerge (MKVToolNix) is not installed or not found.');
  }

  const outDir = path.dirname(outputMkv);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const args = ['-o', outputMkv];

  // Base target file (video + existing tracks)
  args.push(targetVideo);

  // Additional source options (audio or sub sync delay)
  if (options.audio_delay_ms && options.audio_track_ids?.length) {
    for (const tid of options.audio_track_ids) {
      args.push('--sync', `${tid}:${options.audio_delay_ms}`);
    }
  }
  if (options.sub_delay_ms && options.sub_track_ids?.length) {
    for (const tid of options.sub_track_ids) {
      args.push('--sync', `${tid}:${options.sub_delay_ms}`);
    }
  }

  if (options.audio_track_ids && options.audio_track_ids.length > 0) {
    args.push('-a', options.audio_track_ids.join(','));
  }
  if (options.sub_track_ids && options.sub_track_ids.length > 0) {
    args.push('-s', options.sub_track_ids.join(','));
  }

  // Do not duplicate video from source
  args.push('-D', sourceMedia);

  const { stdout, stderr } = await execFileAsync(mkvmerge, args);
  return {
    status: 'ok',
    output_file: outputMkv,
    log: `${stdout}\n${stderr}`.trim(),
  };
}

/**
 * Extract episode numbering info (e.g. S01E02, 1x02, EP02) from filename.
 */
export function extractEpisodeKey(filePath) {
  if (!filePath) return null;
  const base = path.basename(filePath).replace(/\.[^.]+$/, '');
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

/**
 * Match target and source episode files based on episode key.
 */
export function matchEpisodes(targetPaths, sourcePaths) {
  const remainingSources = [...sourcePaths];
  const pairs = [];
  const unmatchedTargets = [];

  for (const target of targetPaths) {
    const tKey = extractEpisodeKey(target);
    if (!tKey) {
      unmatchedTargets.push(target);
      continue;
    }

    let matchIdx = -1;
    for (let i = 0; i < remainingSources.length; i++) {
      const sKey = extractEpisodeKey(remainingSources[i]);
      if (sKey && sKey.episode === tKey.episode) {
        if (tKey.season === null || sKey.season === null || tKey.season === sKey.season) {
          matchIdx = i;
          break;
        }
      }
    }

    if (matchIdx !== -1) {
      pairs.push({
        target,
        source: remainingSources[matchIdx],
        episode: tKey.episode,
        season: tKey.season,
      });
      remainingSources.splice(matchIdx, 1);
    } else {
      unmatchedTargets.push(target);
    }
  }

  return {
    matched_pairs: pairs,
    unmatched_targets: unmatchedTargets,
    unmatched_sources: remainingSources,
  };
}

/**
 * Convert audio to Opus using ffmpeg.
 */
export async function convertAudioToOpus(inputFile, outputFile, options = {}) {
  const ffmpeg = findBinary('ffmpeg');
  if (!ffmpeg) {
    throw new Error('ffmpeg is required for Opus conversion but was not found.');
  }

  const outDir = path.dirname(outputFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const bitrate = options.bitrate || 128;
  const downmix = options.downmix !== false; // default true
  const audioIdx = options.audio_track_index ?? 0;

  const args = [
    '-y',
    '-i', inputFile,
    '-map', `0:a:${audioIdx}`,
    '-c:a', 'libopus',
    '-b:a', `${bitrate}k`,
    '-vbr', 'on',
    '-compression_level', '10',
  ];

  if (downmix) {
    args.push('-ac', '2');
  }

  args.push(outputFile);

  const { stdout, stderr } = await execFileAsync(ffmpeg, args);
  return {
    status: 'ok',
    output_file: outputFile,
    bitrate_kbps: bitrate,
    stereo_downmix: downmix,
    log: `${stdout}\n${stderr}`.trim(),
  };
}

/**
 * Extract font attachments from MKV.
 */
export async function extractAttachments(mkvFile, outputDir) {
  const mkvextract = findBinary('mkvextract');
  if (!mkvextract) {
    throw new Error('mkvextract (MKVToolNix) is not installed or not found.');
  }

  const info = await inspectMedia(mkvFile);
  if (!info.attachments || info.attachments.length === 0) {
    return { extracted_count: 0, files: [] };
  }

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const extractArgs = [mkvFile, 'attachments'];
  const files = [];

  for (const att of info.attachments) {
    const safeName = att.filename || `attachment_${att.id}`;
    const outPath = path.join(outputDir, safeName);
    extractArgs.push(`${att.id}:${outPath}`);
    files.push(outPath);
  }

  await execFileAsync(mkvextract, extractArgs);
  return {
    extracted_count: files.length,
    files,
  };
}

/**
 * Synchronize subtitles from a source MKV and mux into a target MKV (Module 4).
 */
export async function syncSubsFromMkv(targetVideo, sourceMkv, outputMkv, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncforge-mkvsub-'));
  try {
    const srcInfo = await inspectMedia(sourceMkv);
    const subTracks = srcInfo.tracks?.filter(t => t.type === 'subtitles') || [];
    if (subTracks.length === 0) {
      throw new Error(`Source MKV "${sourceMkv}" has no subtitle tracks to extract.`);
    }

    const subTrackId = options.sub_track_id ?? subTracks[0].id;
    const chosenTrack = subTracks.find(t => t.id === subTrackId) || subTracks[0];
    const isAss = (chosenTrack.codec || '').toLowerCase().includes('ass') || (chosenTrack.codec || '').toLowerCase().includes('ssa');
    const ext = isAss ? '.ass' : '.srt';

    const rawSub = path.join(tempDir, `extracted_sub${ext}`);
    const syncedSub = path.join(tempDir, `synced_sub${ext}`);

    // Extract subtitle
    await extractTrack(sourceMkv, subTrackId, rawSub);

    // Sync subtitle
    await syncSubtitles(targetVideo, rawSub, syncedSub, options.max_offset_seconds);

    // If ASS and attachments requested, extract fonts
    let fontFiles = [];
    if (options.import_attachments !== false) {
      try {
        const attResult = await extractAttachments(sourceMkv, path.join(tempDir, 'fonts'));
        fontFiles = attResult.files;
      } catch {}
    }

    // Mux into output MKV
    const mkvmerge = findBinary('mkvmerge');
    if (!mkvmerge) throw new Error('mkvmerge not found');

    const outDir = path.dirname(outputMkv);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const muxArgs = ['-o', outputMkv, targetVideo];

    if (chosenTrack.language) {
      muxArgs.push('--language', `0:${chosenTrack.language}`);
    }
    if (chosenTrack.title) {
      muxArgs.push('--track-name', `0:${chosenTrack.title}`);
    }
    muxArgs.push(syncedSub);

    for (const font of fontFiles) {
      muxArgs.push('--attach-file', font);
    }

    const { stdout, stderr } = await execFileAsync(mkvmerge, muxArgs);
    return {
      status: 'ok',
      output_file: outputMkv,
      sub_track_extracted: subTrackId,
      fonts_attached: fontFiles.length,
      log: `${stdout}\n${stderr}`.trim(),
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Complete WaveSync Injection (Module 5): delay calculation + audio sync + sub sync + remux.
 */
export async function waveSyncInjection(targetVideo, sourceMedia, outputMkv, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncforge-inj-'));
  try {
    // 1. Calculate audio waveform delay
    const delayInfo = await calculateAudioDelay(
      targetVideo,
      sourceMedia,
      options.start_time || '00:02:00',
      options.duration || '00:03:00'
    );
    const audioDelayMs = delayInfo.delay_ms;

    // 2. Subtitle sync if requested
    let syncedSubFile = null;
    let fontFiles = [];
    if (options.import_subtitles) {
      const srcInfo = await inspectMedia(sourceMedia);
      const subTracks = srcInfo.tracks?.filter(t => t.type === 'subtitles') || [];
      if (subTracks.length > 0) {
        const subId = options.sub_track_id ?? subTracks[0].id;
        const subTrack = subTracks.find(t => t.id === subId) || subTracks[0];
        const isAss = (subTrack.codec || '').toLowerCase().includes('ass');
        const ext = isAss ? '.ass' : '.srt';
        const rawSub = path.join(tempDir, `raw_sub${ext}`);
        syncedSubFile = path.join(tempDir, `synced_sub${ext}`);

        await extractTrack(sourceMedia, subId, rawSub);
        await syncSubtitles(targetVideo, rawSub, syncedSubFile, options.max_offset_seconds);

        if (options.import_attachments !== false) {
          try {
            const att = await extractAttachments(sourceMedia, path.join(tempDir, 'fonts'));
            fontFiles = att.files;
          } catch {}
        }
      }
    }

    // 3. Audio conversion to Opus if requested
    let audioToMux = sourceMedia;
    let audioMuxArgs = [];
    if (options.convert_opus) {
      const opusFile = path.join(tempDir, 'injected_audio.opus');
      await convertAudioToOpus(sourceMedia, opusFile, {
        bitrate: options.opus_bitrate || 128,
        downmix: options.opus_downmix !== false,
      });
      audioToMux = opusFile;
      audioMuxArgs = ['--sync', `0:${audioDelayMs}`, opusFile];
    } else {
      audioMuxArgs = ['--sync', `${options.audio_track_id ?? 0}:${audioDelayMs}`];
      if (options.audio_track_id !== undefined) {
        audioMuxArgs.push('-a', String(options.audio_track_id));
      }
      audioMuxArgs.push('-D', '-S', sourceMedia);
    }

    // 4. Mux together
    const mkvmerge = findBinary('mkvmerge');
    if (!mkvmerge) throw new Error('mkvmerge not found');

    const outDir = path.dirname(outputMkv);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const muxArgs = ['-o', outputMkv];

    // Target video
    if (options.keep_target_audio === false) {
      muxArgs.push('-A');
    }
    if (options.keep_target_subs === false) {
      muxArgs.push('-S');
    }
    muxArgs.push(targetVideo);

    // Injected audio
    muxArgs.push(...audioMuxArgs);

    // Injected subs if any
    if (syncedSubFile) {
      muxArgs.push(syncedSubFile);
    }

    // Injected fonts if any
    for (const f of fontFiles) {
      muxArgs.push('--attach-file', f);
    }

    const { stdout, stderr } = await execFileAsync(mkvmerge, muxArgs);
    return {
      status: 'ok',
      output_file: outputMkv,
      calculated_delay_ms: audioDelayMs,
      confidence_score: delayInfo.confidence_score,
      subtitles_synced: Boolean(syncedSubFile),
      fonts_attached: fontFiles.length,
      opus_converted: Boolean(options.convert_opus),
      log: `${stdout}\n${stderr}`.trim(),
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Self-Sync Audio & Subtitles within a single video file without external muxing.
 */
export async function selfSyncTracks(videoFile, outputMkv, options = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncforge-selfsync-'));
  try {
    const meta = await inspectMedia(videoFile);
    const audioTracks = meta.tracks?.filter(t => t.type === 'audio') || [];
    const subTracks = meta.tracks?.filter(t => t.type === 'subtitles') || [];

    let audioDelayMs = 0;
    let syncedSubFile = null;
    let targetSubTrack = null;
    let targetAudioTrack = null;

    if (options.sync_audio !== false && audioTracks.length >= 2) {
      const refAudioId = options.ref_audio_id ?? audioTracks[0].id;
      const targetAudioId = options.target_audio_id ?? audioTracks[1].id;
      targetAudioTrack = audioTracks.find(t => t.id === targetAudioId) || audioTracks[1];

      const refMka = path.join(tempDir, 'ref_audio.mka');
      const tgtMka = path.join(tempDir, 'tgt_audio.mka');
      await extractTrack(videoFile, refAudioId, refMka);
      await extractTrack(videoFile, targetAudioId, tgtMka);

      const delayInfo = await calculateAudioDelay(
        refMka,
        tgtMka,
        options.start_time || '00:02:00',
        options.duration || '00:03:00'
      );
      audioDelayMs = delayInfo.delay_ms;
    }

    if (options.sync_subs !== false && subTracks.length > 0) {
      const subId = options.target_sub_id ?? subTracks[0].id;
      targetSubTrack = subTracks.find(t => t.id === subId) || subTracks[0];
      const isAss = (targetSubTrack.codec || '').toLowerCase().includes('ass');
      const ext = isAss ? '.ass' : '.srt';
      const rawSub = path.join(tempDir, `raw_sub${ext}`);
      syncedSubFile = path.join(tempDir, `synced_sub${ext}`);

      await extractTrack(videoFile, subId, rawSub);
      await syncSubtitles(videoFile, rawSub, syncedSubFile, options.max_offset_seconds);
    }

    const mkvmergeBin = findBinary('mkvmerge');
    const cmd = ['-o', outputMkv];

    if (syncedSubFile && targetSubTrack) {
      const otherSubs = subTracks.filter(t => t.id !== targetSubTrack.id).map(t => t.id);
      if (otherSubs.length === 0) {
        cmd.push('--no-subtitles');
      } else {
        cmd.push('--subtitle-tracks', otherSubs.join(','));
      }
    }

    if (targetAudioTrack && audioDelayMs !== 0) {
      cmd.push('--sync', `${targetAudioTrack.id}:${audioDelayMs}`);
    }

    cmd.push(videoFile);

    if (syncedSubFile && targetSubTrack) {
      const lang = targetSubTrack.properties?.language || 'und';
      cmd.push('--language', `0:${lang}`);
      if (targetSubTrack.properties?.track_name) {
        cmd.push('--track-name', `0:${targetSubTrack.properties.track_name}`);
      }
      cmd.push(syncedSubFile);
    }

    await execFileAsync(mkvmergeBin, cmd);
    return {
      status: 'ok',
      output: outputMkv,
      audio_delay_ms: audioDelayMs,
      subtitle_synced: Boolean(syncedSubFile),
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Execute any of the 7 modules on an entire batch directory.
 */
export async function runBatch(moduleId, targetFolder, sourceFolder = null, outputFolder = null, options = {}) {
  const outDir = outputFolder || path.join(targetFolder, 'SyncForge_Output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const videoExts = ['mkv', 'mp4', 'avi', 'mov', 'webm'];
  const targets = getFilesRecursive(targetFolder, videoExts);
  if (targets.length === 0) {
    return { status: 'empty', message: `No video files found in ${targetFolder}`, processed: 0 };
  }

  const results = [];

  switch (moduleId) {
    case 'stream_manager': {
      for (const t of targets) {
        const outName = path.basename(t);
        const outMkv = path.join(outDir, outName.replace(/\.[^.]+$/, '.mkv'));
        const r = await filterAndCleanTracks(t, outMkv, options);
        results.push({ file: path.basename(t), output: outMkv, status: r.status });
      }
      break;
    }

    case 'set_default': {
      for (const t of targets) {
        const r = await setTrackFlags(t, options);
        results.push({ file: path.basename(t), status: r.status });
      }
      break;
    }

    case 'sync_subs': {
      if (!sourceFolder) throw new Error('Subtitle source folder is required for sync_subs batch.');
      const subs = getFilesRecursive(sourceFolder, ['srt', 'ass', 'ssa', 'vtt']);
      const match = matchEpisodes(targets, subs);
      for (const pair of match.matched_pairs) {
        const subExt = path.extname(pair.source);
        const outSub = path.join(outDir, path.basename(pair.target).replace(/\.[^.]+$/, subExt));
        const r = await syncSubtitles(pair.target, pair.source, outSub, options.max_offset_seconds);
        results.push({ episode: pair.episode, video: path.basename(pair.target), sub: path.basename(pair.source), output: outSub });
      }
      break;
    }

    case 'sync_subs_mkv': {
      if (!sourceFolder) throw new Error('Source MKV folder is required for sync_subs_mkv batch.');
      const sources = getFilesRecursive(sourceFolder, ['mkv']);
      const match = matchEpisodes(targets, sources);
      for (const pair of match.matched_pairs) {
        const outMkv = path.join(outDir, path.basename(pair.target).replace(/\.[^.]+$/, '.mkv'));
        const r = await syncSubsFromMkv(pair.target, pair.source, outMkv, options);
        results.push({ episode: pair.episode, target: path.basename(pair.target), source: path.basename(pair.source), output: outMkv });
      }
      break;
    }

    case 'injection': {
      if (!sourceFolder) throw new Error('Source media folder is required for injection batch.');
      const sources = getFilesRecursive(sourceFolder, videoExts);
      const match = matchEpisodes(targets, sources);
      for (const pair of match.matched_pairs) {
        const outMkv = path.join(outDir, path.basename(pair.target).replace(/\.[^.]+$/, '.mkv'));
        const r = await waveSyncInjection(pair.target, pair.source, outMkv, options);
        results.push({
          episode: pair.episode,
          target: path.basename(pair.target),
          source: path.basename(pair.source),
          delay_ms: r.calculated_delay_ms,
          output: outMkv,
        });
      }
      break;
    }

    case 'custom_merge': {
      if (!sourceFolder) throw new Error('Source media folder is required for custom_merge batch.');
      const sources = getFilesRecursive(sourceFolder, videoExts);
      const match = matchEpisodes(targets, sources);
      for (const pair of match.matched_pairs) {
        const outMkv = path.join(outDir, path.basename(pair.target).replace(/\.[^.]+$/, '.mkv'));
        const r = await mergeTracks(pair.target, pair.source, outMkv, options);
        results.push({ episode: pair.episode, target: path.basename(pair.target), source: path.basename(pair.source), output: outMkv });
      }
      break;
    }

    case 'internal_sync': {
      for (const t of targets) {
        const outName = path.basename(t);
        const outMkv = path.join(outDir, outName.replace(/\.[^.]+$/, '_synced.mkv'));
        const r = await selfSyncTracks(t, outMkv, options);
        results.push({ file: path.basename(t), output: outMkv, status: r.status, audio_delay_ms: r.audio_delay_ms });
      }
      break;
    }

    default:
      throw new Error(`Unknown module ID: ${moduleId}`);
  }

  return {
    status: 'ok',
    module: moduleId,
    total_processed: results.length,
    output_directory: outDir,
    results,
  };
}
