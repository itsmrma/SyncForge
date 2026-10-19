import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const OPENSUBTITLES_API_BASE = 'https://api.opensubtitles.com/api/v1';
const DEFAULT_USER_AGENT = 'SyncForge v3.3.1';

/**
 * Returns the path to the shared user configuration file on disk.
 * Shared between the SyncForge desktop GUI and MCP server.
 */
export function getConfigFilePath() {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'syncforge', 'config.json');
  }
  return path.join(os.homedir(), '.config', 'syncforge', 'config.json');
}

/**
 * Retrieves the saved OpenSubtitles API key and optional token from:
 * 1. Environment variables (OPENSUBTITLES_API_KEY, OPENSUBTITLES_TOKEN)
 * 2. Shared SyncForge user config file (~/.config/syncforge/config.json or %APPDATA%\syncforge\config.json)
 */
export function getSavedOpenSubtitlesConfig() {
  let apiKey = (process.env.OPENSUBTITLES_API_KEY || '').trim();
  let userToken = (process.env.OPENSUBTITLES_TOKEN || '').trim();

  const configPath = getConfigFilePath();
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!apiKey && data.opensubtitles_api_key) {
        apiKey = String(data.opensubtitles_api_key).trim();
      }
      if (!userToken && data.opensubtitles_token) {
        userToken = String(data.opensubtitles_token).trim();
      }
    } catch {}
  }

  if (!apiKey && process.platform === 'win32') {
    const fallbackPath = path.join(os.homedir(), '.config', 'syncforge', 'config.json');
    if (fs.existsSync(fallbackPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
        if (data.opensubtitles_api_key) {
          apiKey = String(data.opensubtitles_api_key).trim();
        }
        if (!userToken && data.opensubtitles_token) {
          userToken = String(data.opensubtitles_token).trim();
        }
      } catch {}
    }
  }

  return { apiKey, userToken };
}

/**
 * Saves OpenSubtitles credentials into the shared user configuration file.
 */
export function saveOpenSubtitlesConfig({ apiKey, userToken }) {
  const configPath = getConfigFilePath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let current = {};
  if (fs.existsSync(configPath)) {
    try {
      current = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      current = {};
    }
  }
  if (apiKey !== undefined) current.opensubtitles_api_key = apiKey;
  if (userToken !== undefined) current.opensubtitles_token = userToken;
  fs.writeFileSync(configPath, JSON.stringify(current, null, 2), 'utf8');
  return {
    status: 'saved',
    config_path: configPath,
    api_key_configured: Boolean(current.opensubtitles_api_key),
  };
}

/**
 * Computes OpenSubtitles 64-bit movie hash from the first and last 64KB of a file.
 * Compatible with official OpenSubtitles hashing specifications.
 */
export async function computeMovieHash(filePath) {
  const stat = await fs.promises.stat(filePath);
  const fileSize = stat.size;
  const chunkSize = 65536; // 64 KB

  if (fileSize < chunkSize) {
    throw new Error(`File is too small (${fileSize} bytes) to calculate OpenSubtitles hash.`);
  }

  const fd = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(chunkSize * 2);

    // Read first 64KB
    await fd.read(buffer, 0, chunkSize, 0);

    // Read last 64KB
    await fd.read(buffer, chunkSize, chunkSize, fileSize - chunkSize);

    let hash = BigInt(fileSize);

    for (let i = 0; i < buffer.length; i += 8) {
      const chunkValue = buffer.readBigInt64LE(i);
      hash = (hash + chunkValue) & 0xFFFFFFFFFFFFFFFFn;
    }

    const moviehash = hash.toString(16).padStart(16, '0');
    return {
      moviehash,
      moviebytesize: fileSize,
    };
  } finally {
    await fd.close();
  }
}

/**
 * Search OpenSubtitles.com REST API v1.
 */
export async function searchOpenSubtitles({
  apiKey,
  userToken,
  query,
  filePath,
  imdbId,
  tmdbId,
  seasonNumber,
  episodeNumber,
  languages = 'it,en',
  type,
  hearingImpaired = 'include',
  orderBy = 'download_count',
  page = 1,
}) {
  const saved = getSavedOpenSubtitlesConfig();
  const key = apiKey || saved.apiKey;
  const token = userToken || saved.userToken;

  if (!key) {
    throw new Error(
      'OpenSubtitles API Key is required. Please set it in SyncForge Settings (GUI), set the OPENSUBTITLES_API_KEY environment variable, or configure it via the syncforge_configure_opensubtitles MCP tool. ' +
      'You can obtain a free API key at: https://www.opensubtitles.com/en/consumers'
    );
  }

  const url = new URL(`${OPENSUBTITLES_API_BASE}/subtitles`);

  // Normalize language codes (e.g. 'ita' -> 'it', 'eng' -> 'en' or comma list)
  if (languages) {
    url.searchParams.set('languages', languages.toLowerCase());
  }

  // Calculate file hash if file path is provided
  if (filePath && fs.existsSync(filePath)) {
    try {
      const hashInfo = await computeMovieHash(filePath);
      url.searchParams.set('moviehash', hashInfo.moviehash);
    } catch {}
  }

  if (query) url.searchParams.set('query', query);
  if (imdbId) url.searchParams.set('imdb_id', String(imdbId).replace(/^tt/, ''));
  if (tmdbId) url.searchParams.set('tmdb_id', String(tmdbId));
  if (seasonNumber !== undefined && seasonNumber !== null) url.searchParams.set('season_number', String(seasonNumber));
  if (episodeNumber !== undefined && episodeNumber !== null) url.searchParams.set('episode_number', String(episodeNumber));
  if (type) url.searchParams.set('type', type);
  if (hearingImpaired) url.searchParams.set('hearing_impaired', hearingImpaired);
  if (orderBy) url.searchParams.set('order_by', orderBy);
  if (page) url.searchParams.set('page', String(page));

  const headers = {
    'Api-Key': key,
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept': 'application/json',
  };

  if (userToken || process.env.OPENSUBTITLES_TOKEN) {
    headers['Authorization'] = `Bearer ${userToken || process.env.OPENSUBTITLES_TOKEN}`;
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenSubtitles search failed (${response.status} ${response.statusText}): ${errorText}`);
  }

  const data = await response.json();
  const rawList = data.data || [];

  const results = rawList.map(item => {
    const attr = item.attributes || {};
    const file = (attr.files && attr.files[0]) || {};
    return {
      id: item.id,
      file_id: file.file_id,
      file_name: file.file_name,
      language: attr.language,
      format: attr.format,
      download_count: attr.download_count,
      ratings: attr.ratings,
      fps: attr.fps,
      hearing_impaired: attr.hearing_impaired,
      release: attr.release,
      movie_name: attr.feature_details?.movie_name,
      year: attr.feature_details?.year,
      ai_translated: attr.ai_translated,
      machine_translated: attr.machine_translated,
      from_trusted: attr.from_trusted,
    };
  });

  return {
    total_count: data.total_count || results.length,
    page: data.page || 1,
    subtitles: results,
  };
}

/**
 * Download a subtitle by file_id from OpenSubtitles.com.
 */
export async function downloadOpenSubtitle({
  apiKey,
  userToken,
  fileId,
  subFormat = 'srt',
  outputPath,
}) {
  const saved = getSavedOpenSubtitlesConfig();
  const key = apiKey || saved.apiKey;
  const token = userToken || saved.userToken;

  if (!key) {
    throw new Error(
      'OpenSubtitles API Key is required. Please set it in SyncForge Settings (GUI), set the OPENSUBTITLES_API_KEY environment variable, or configure it via the syncforge_configure_opensubtitles MCP tool. ' +
      'You can obtain a free API key at: https://www.opensubtitles.com/en/consumers'
    );
  }

  const headers = {
    'Api-Key': key,
    'User-Agent': DEFAULT_USER_AGENT,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const dlResp = await fetch(`${OPENSUBTITLES_API_BASE}/download`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      file_id: Number(fileId),
      sub_format: subFormat,
    }),
  });

  if (!dlResp.ok) {
    const errText = await dlResp.text();
    throw new Error(`OpenSubtitles download failed (${dlResp.status}): ${errText}`);
  }

  const dlData = await dlResp.json();
  const fileUrl = dlData.link;
  if (!fileUrl) {
    throw new Error('OpenSubtitles did not return a valid download link.');
  }

  // Fetch subtitle file bytes
  const contentResp = await fetch(fileUrl);
  if (!contentResp.ok) {
    throw new Error(`Failed to download subtitle content from CDN (${contentResp.status})`);
  }

  const subText = await contentResp.text();

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  await fs.promises.writeFile(outputPath, subText, 'utf8');

  return {
    status: 'ok',
    output_path: outputPath,
    file_id: fileId,
    file_name: dlData.file_name,
    remaining_quota: dlData.remaining,
    requests: dlData.requests,
  };
}
