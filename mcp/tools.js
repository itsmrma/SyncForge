import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  calculateAudioDelay,
  convertAudioToOpus,
  extractAttachments,
  extractTrack,
  filterAndCleanTracks,
  findBinary,
  getSystemHealth,
  inspectMedia,
  matchEpisodes,
  mergeTracks,
  runBatch,
  setTrackFlags,
  syncSubsFromMkv,
  syncSubtitles,
  waveSyncInjection,
} from './media.js';
import {
  computeMovieHash,
  downloadOpenSubtitle,
  getConfigFilePath,
  getSavedOpenSubtitlesConfig,
  saveOpenSubtitlesConfig,
  searchOpenSubtitles,
} from './opensubtitles.js';
import { MODULES_INFO } from './resources.js';

export const TOOLS_DEFINITIONS = [
  {
    name: 'syncforge_check_dependencies',
    description: 'Check whether external media tools (mkvmerge, mkvextract, mkvpropedit, ffmpeg, ffprobe, ffsubsync, mpv) are installed, their paths, versions, and installation instructions.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_inspect_media',
    description: 'Inspect a media file or directory. For files: returns detailed container info, video/audio/subtitle tracks (ID, codec, language, title, default, forced flags), and attachments. For folders: returns counts, track signatures, and file samples.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to media file (.mkv, .mp4, .avi, .srt, etc.) or directory to inspect',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_calculate_audio_delay',
    description: 'Calculate the millisecond waveform delay between two media files (reference video and source audio/video) using audio segment extraction and cross-correlation.',
    inputSchema: {
      type: 'object',
      properties: {
        reference_media: {
          type: 'string',
          description: 'Path to reference media file (e.g. target high-definition video)',
        },
        source_media: {
          type: 'string',
          description: 'Path to source media file to be synchronized',
        },
        start_time: {
          type: 'string',
          description: 'Start timestamp for audio segment analysis (default: "00:02:00")',
          default: '00:02:00',
        },
        duration: {
          type: 'string',
          description: 'Duration of audio segment to analyze (default: "00:03:00")',
          default: '00:03:00',
        },
      },
      required: ['reference_media', 'source_media'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_sync_subtitles',
    description: 'Synchronize an external subtitle file (.srt, .ass, .vtt) with reference video speech/audio using FFsubsync.',
    inputSchema: {
      type: 'object',
      properties: {
        reference_video: {
          type: 'string',
          description: 'Path to reference video file with audio speech',
        },
        subtitle_file: {
          type: 'string',
          description: 'Path to out-of-sync subtitle file (.srt, .ass, etc.)',
        },
        output_file: {
          type: 'string',
          description: 'Path for the resulting aligned subtitle file',
        },
        max_offset_seconds: {
          type: 'number',
          description: 'Maximum allowable offset in seconds (e.g. 60)',
        },
      },
      required: ['reference_video', 'subtitle_file', 'output_file'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_set_track_flags',
    description: 'Modify Default and Forced track metadata flags directly in an MKV file using mkvpropedit without remuxing (lossless and instantaneous).',
    inputSchema: {
      type: 'object',
      properties: {
        mkv_file: {
          type: 'string',
          description: 'Path to MKV file to edit',
        },
        default_audio_id: {
          type: 'number',
          description: 'Track ID to set as default audio',
        },
        forced_audio_id: {
          type: 'number',
          description: 'Track ID to set as forced audio',
        },
        default_sub_id: {
          type: 'number',
          description: 'Track ID to set as default subtitle',
        },
        forced_sub_id: {
          type: 'number',
          description: 'Track ID to set as forced subtitle',
        },
        clear_other_defaults: {
          type: 'boolean',
          description: 'Whether to unset default flags on all other tracks of the same type (default: true)',
          default: true,
        },
      },
      required: ['mkv_file'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_extract_track',
    description: 'Extract a specific audio or subtitle track from an MKV file using mkvextract.',
    inputSchema: {
      type: 'object',
      properties: {
        mkv_file: {
          type: 'string',
          description: 'Path to MKV file',
        },
        track_id: {
          type: 'number',
          description: 'Track ID to extract',
        },
        output_path: {
          type: 'string',
          description: 'Path to save extracted track (.srt, .ass, .aac, .opus, etc.)',
        },
      },
      required: ['mkv_file', 'track_id', 'output_path'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_filter_and_clean_tracks',
    description: 'Losslessly remux an MKV file keeping only specified video, audio, and subtitle track IDs, removing unwanted commentaries or foreign languages.',
    inputSchema: {
      type: 'object',
      properties: {
        input_mkv: {
          type: 'string',
          description: 'Path to source MKV file',
        },
        output_mkv: {
          type: 'string',
          description: 'Destination path for cleaned MKV file',
        },
        video_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of video track IDs to keep (omitted = keep all)',
        },
        audio_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of audio track IDs to keep (empty array = strip all audio)',
        },
        sub_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of subtitle track IDs to keep (empty array = strip all subtitles)',
        },
      },
      required: ['input_mkv', 'output_mkv'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_merge_tracks',
    description: 'Merge selected tracks from target video and source media files into an output MKV, applying optional millisecond delays for audio or subtitles.',
    inputSchema: {
      type: 'object',
      properties: {
        target_video: {
          type: 'string',
          description: 'Path to base video MKV file',
        },
        source_media: {
          type: 'string',
          description: 'Path to source media containing audio or subtitles to import',
        },
        output_mkv: {
          type: 'string',
          description: 'Destination path for merged MKV file',
        },
        audio_delay_ms: {
          type: 'number',
          description: 'Millisecond delay offset to apply to imported audio tracks (+/-)',
        },
        sub_delay_ms: {
          type: 'number',
          description: 'Millisecond delay offset to apply to imported subtitle tracks (+/-)',
        },
        audio_track_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of source audio track IDs to import',
        },
        sub_track_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of source subtitle track IDs to import',
        },
      },
      required: ['target_video', 'source_media', 'output_mkv'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_preview_mpv',
    description: 'Generate or execute an MPV command to preview target video with custom audio or subtitle delays.',
    inputSchema: {
      type: 'object',
      properties: {
        target_video: {
          type: 'string',
          description: 'Path to video file',
        },
        audio_file: {
          type: 'string',
          description: 'External audio track to preview',
        },
        audio_delay_ms: {
          type: 'number',
          description: 'Audio delay in milliseconds',
        },
        sub_file: {
          type: 'string',
          description: 'External subtitle file to preview',
        },
        sub_delay_ms: {
          type: 'number',
          description: 'Subtitle delay in milliseconds',
        },
        start_time: {
          type: 'string',
          description: 'Start position timestamp (e.g. "00:05:00")',
        },
      },
      required: ['target_video'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_list_modules',
    description: 'List all 6 built-in SyncForge processing modules, their required inputs, and applicable settings.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_match_episodes',
    description: 'Match video files and source audio/subtitle files across two directories by episode key (e.g. S01E01, 1x01, EP01). Identifies matched pairs and missing/unmatched files.',
    inputSchema: {
      type: 'object',
      properties: {
        target_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of target video file paths',
        },
        source_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of source audio/video/subtitle file paths to match',
        },
      },
      required: ['target_paths', 'source_paths'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_wavesync_injection',
    description: 'Execute complete WaveSync Injection (Module 5): extracts waveforms, calculates cross-correlation delay, synchronizes audio and subtitles, copies fonts, optionally encodes audio to Opus, and muxes losslessly into destination MKV.',
    inputSchema: {
      type: 'object',
      properties: {
        target_video: {
          type: 'string',
          description: 'Path to target high-quality video',
        },
        source_media: {
          type: 'string',
          description: 'Path to source media containing desired audio or subtitles',
        },
        output_mkv: {
          type: 'string',
          description: 'Destination path for output MKV file',
        },
        start_time: {
          type: 'string',
          description: 'Start timestamp for audio delay analysis (default: "00:02:00")',
          default: '00:02:00',
        },
        duration: {
          type: 'string',
          description: 'Duration of audio analysis window (default: "00:03:00")',
          default: '00:03:00',
        },
        audio_track_id: {
          type: 'number',
          description: 'Source audio track ID to inject (default: 0)',
        },
        import_subtitles: {
          type: 'boolean',
          description: 'Whether to also extract and align subtitles from source (default: false)',
        },
        sub_track_id: {
          type: 'number',
          description: 'Specific subtitle track ID to extract and sync',
        },
        import_attachments: {
          type: 'boolean',
          description: 'Whether to import font attachments from source MKV (default: true)',
          default: true,
        },
        convert_opus: {
          type: 'boolean',
          description: 'Whether to re-encode injected audio to Opus (default: false)',
        },
        opus_bitrate: {
          type: 'number',
          description: 'Opus bitrate in kbps (default: 128)',
          default: 128,
        },
        opus_downmix: {
          type: 'boolean',
          description: 'Downmix 5.1/7.1 audio to stereo Opus (default: true)',
          default: true,
        },
        keep_target_audio: {
          type: 'boolean',
          description: 'Whether to keep original audio from target video (default: true)',
          default: true,
        },
        keep_target_subs: {
          type: 'boolean',
          description: 'Whether to keep original subtitles from target video (default: true)',
          default: true,
        },
      },
      required: ['target_video', 'source_media', 'output_mkv'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_sync_subs_from_mkv',
    description: 'Extract and sync subtitles from an MKV (Module 4): extracts subtitle stream from source MKV, aligns it to target video audio using ffsubsync, copies font attachments, and muxes into target MKV.',
    inputSchema: {
      type: 'object',
      properties: {
        target_video: {
          type: 'string',
          description: 'Path to target video file',
        },
        source_mkv: {
          type: 'string',
          description: 'Path to source MKV containing subtitle tracks',
        },
        output_mkv: {
          type: 'string',
          description: 'Destination path for merged MKV file',
        },
        sub_track_id: {
          type: 'number',
          description: 'Subtitle track ID to extract (omitted = first subtitle track)',
        },
        max_offset_seconds: {
          type: 'number',
          description: 'Max allowable synchronization offset in seconds',
        },
        import_attachments: {
          type: 'boolean',
          description: 'Whether to copy font attachments from source MKV (default: true)',
          default: true,
        },
      },
      required: ['target_video', 'source_mkv', 'output_mkv'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_convert_audio_opus',
    description: 'Convert any audio track or media file to high-efficiency Opus format (.opus) using FFmpeg with custom bitrate and optional stereo downmix.',
    inputSchema: {
      type: 'object',
      properties: {
        input_file: {
          type: 'string',
          description: 'Path to input media file',
        },
        output_file: {
          type: 'string',
          description: 'Destination path for .opus audio file',
        },
        bitrate: {
          type: 'number',
          description: 'Opus bitrate in kbps (e.g. 64, 96, 128, 160, 192, 256, 320; default: 128)',
          default: 128,
        },
        downmix: {
          type: 'boolean',
          description: 'Downmix multi-channel audio to 2-channel stereo (default: true)',
          default: true,
        },
        audio_track_index: {
          type: 'number',
          description: '0-based audio track index to convert (default: 0)',
          default: 0,
        },
      },
      required: ['input_file', 'output_file'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_extract_attachments',
    description: 'Extract all font attachments (.ttf, .otf) and attachments from an MKV file to a destination directory using mkvextract.',
    inputSchema: {
      type: 'object',
      properties: {
        mkv_file: {
          type: 'string',
          description: 'Path to MKV file',
        },
        output_dir: {
          type: 'string',
          description: 'Directory where extracted font files should be saved',
        },
      },
      required: ['mkv_file', 'output_dir'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_run_batch',
    description: 'Run any of the 6 SyncForge processing modes across an entire directory of TV show episodes or movies in batch with automatic episode matching.',
    inputSchema: {
      type: 'object',
      properties: {
        module_id: {
          type: 'string',
          enum: ['stream_manager', 'set_default', 'sync_subs', 'sync_subs_mkv', 'injection', 'custom_merge'],
          description: 'Module ID to execute in batch',
        },
        target_folder: {
          type: 'string',
          description: 'Directory containing target video files',
        },
        source_folder: {
          type: 'string',
          description: 'Directory containing source files (required for 2-input modules: sync_subs, sync_subs_mkv, injection, custom_merge)',
        },
        output_folder: {
          type: 'string',
          description: 'Destination directory for batch outputs (default: <target_folder>/SyncForge_Output)',
        },
        options: {
          type: 'object',
          description: 'Module-specific options (e.g. max_offset_seconds, convert_opus, opus_bitrate, opus_downmix, video_ids, audio_ids, sub_ids, default_audio_id, default_sub_id)',
        },
      },
      required: ['module_id', 'target_folder'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_search_subtitles_online',
    description: 'Search OpenSubtitles.com for available subtitles matching a video file, title, IMDb ID, TMDb ID, or season/episode. Automatically computes 64-bit moviehash if video file is provided for exact synchronization matching.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Movie or TV show title to search',
        },
        file_path: {
          type: 'string',
          description: 'Path to local video file (calculates exact moviehash for high-precision match)',
        },
        languages: {
          type: 'string',
          description: 'Comma-separated ISO language codes (e.g. "it,en", "it", "en"; default: "it,en")',
          default: 'it,en',
        },
        imdb_id: {
          type: 'string',
          description: 'IMDb ID (e.g. "tt0133093" or "0133093")',
        },
        tmdb_id: {
          type: 'number',
          description: 'TMDb numeric ID',
        },
        season_number: {
          type: 'number',
          description: 'TV show season number',
        },
        episode_number: {
          type: 'number',
          description: 'TV show episode number',
        },
        type: {
          type: 'string',
          enum: ['movie', 'episode', 'all'],
          description: 'Type of media',
        },
        hearing_impaired: {
          type: 'string',
          enum: ['include', 'exclude', 'only'],
          description: 'Hearing impaired subtitles filter (default: "include")',
          default: 'include',
        },
        order_by: {
          type: 'string',
          enum: ['download_count', 'ratings', 'upload_date'],
          description: 'Sort criteria (default: "download_count")',
          default: 'download_count',
        },
        api_key: {
          type: 'string',
          description: 'OpenSubtitles API key (optional if OPENSUBTITLES_API_KEY env is set)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_download_subtitle_online',
    description: 'Download a subtitle file directly from OpenSubtitles.com by its file_id.',
    inputSchema: {
      type: 'object',
      properties: {
        file_id: {
          type: 'number',
          description: 'Unique file_id of the subtitle from search results',
        },
        output_path: {
          type: 'string',
          description: 'Local destination path for downloaded subtitle file (.srt, .vtt)',
        },
        sub_format: {
          type: 'string',
          enum: ['srt', 'vtt'],
          description: 'Desired subtitle format (default: "srt")',
          default: 'srt',
        },
        api_key: {
          type: 'string',
          description: 'OpenSubtitles API key (optional if OPENSUBTITLES_API_KEY env is set)',
        },
      },
      required: ['file_id', 'output_path'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_auto_fetch_and_sync_subtitle',
    description: 'All-in-one subtitle locator and aligner: hashes a video file, queries OpenSubtitles.com for the best subtitle in target language(s), downloads it, and immediately aligns it to the video audio speech using FFsubsync.',
    inputSchema: {
      type: 'object',
      properties: {
        video_path: {
          type: 'string',
          description: 'Path to local video file needing subtitles',
        },
        output_sub_path: {
          type: 'string',
          description: 'Destination path for the final synchronized subtitle file (.srt)',
        },
        languages: {
          type: 'string',
          description: 'Target language codes (e.g. "it", "it,en"; default: "it,en")',
          default: 'it,en',
        },
        max_offset_seconds: {
          type: 'number',
          description: 'Maximum allowable ffsubsync offset in seconds (default: 60)',
          default: 60,
        },
        api_key: {
          type: 'string',
          description: 'OpenSubtitles API key (optional if OPENSUBTITLES_API_KEY env is set)',
        },
      },
      required: ['video_path', 'output_sub_path'],
      additionalProperties: false,
    },
  },
  {
    name: 'syncforge_configure_opensubtitles',
    description: 'Save or update the OpenSubtitles API key and optional user token in the shared SyncForge user configuration (~/.config/syncforge/config.json). Settings saved here are instantly accessible to both the GUI and AI agents.',
    inputSchema: {
      type: 'object',
      properties: {
        api_key: {
          type: 'string',
          description: 'OpenSubtitles REST API consumer key (obtainable free at https://www.opensubtitles.com/en/consumers)',
        },
        user_token: {
          type: 'string',
          description: 'Optional OpenSubtitles VIP / user JWT token for increased download quota',
        },
      },
      required: ['api_key'],
      additionalProperties: false,
    },
  },
];

export async function handleToolCall(name, args) {
  switch (name) {
    case 'syncforge_check_dependencies': {
      const health = await getSystemHealth();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(health, null, 2),
          },
        ],
      };
    }

    case 'syncforge_inspect_media': {
      const data = await inspectMedia(args.path);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    case 'syncforge_calculate_audio_delay': {
      const result = await calculateAudioDelay(
        args.reference_media,
        args.source_media,
        args.start_time || '00:02:00',
        args.duration || '00:03:00'
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'syncforge_sync_subtitles': {
      const res = await syncSubtitles(
        args.reference_video,
        args.subtitle_file,
        args.output_file,
        args.max_offset_seconds
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_set_track_flags': {
      const res = await setTrackFlags(args.mkv_file, {
        default_audio_id: args.default_audio_id,
        forced_audio_id: args.forced_audio_id,
        default_sub_id: args.default_sub_id,
        forced_sub_id: args.forced_sub_id,
        clear_other_defaults: args.clear_other_defaults !== false,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_extract_track': {
      const res = await extractTrack(args.mkv_file, args.track_id, args.output_path);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_filter_and_clean_tracks': {
      const res = await filterAndCleanTracks(args.input_mkv, args.output_mkv, {
        video_ids: args.video_ids,
        audio_ids: args.audio_ids,
        sub_ids: args.sub_ids,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_merge_tracks': {
      const res = await mergeTracks(args.target_video, args.source_media, args.output_mkv, {
        audio_delay_ms: args.audio_delay_ms,
        sub_delay_ms: args.sub_delay_ms,
        audio_track_ids: args.audio_track_ids,
        sub_track_ids: args.sub_track_ids,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_preview_mpv': {
      const mpv = findBinary('mpv') || 'mpv';
      const cmd = [mpv, args.target_video];
      if (args.audio_file) cmd.push(`--audio-file=${args.audio_file}`);
      if (args.audio_delay_ms !== undefined) cmd.push(`--audio-delay=${(args.audio_delay_ms / 1000).toFixed(3)}`);
      if (args.sub_file) cmd.push(`--sub-file=${args.sub_file}`);
      if (args.sub_delay_ms !== undefined) cmd.push(`--sub-delay=${(args.sub_delay_ms / 1000).toFixed(3)}`);
      if (args.start_time) cmd.push(`--start=${args.start_time}`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'command_generated',
              command: cmd.join(' '),
              args: cmd,
              mpv_installed: Boolean(findBinary('mpv')),
            }, null, 2),
          },
        ],
      };
    }

    case 'syncforge_list_modules': {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(MODULES_INFO, null, 2),
          },
        ],
      };
    }

    case 'syncforge_match_episodes': {
      const res = matchEpisodes(args.target_paths, args.source_paths);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_wavesync_injection': {
      const res = await waveSyncInjection(args.target_video, args.source_media, args.output_mkv, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_sync_subs_from_mkv': {
      const res = await syncSubsFromMkv(args.target_video, args.source_mkv, args.output_mkv, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_convert_audio_opus': {
      const res = await convertAudioToOpus(args.input_file, args.output_file, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_extract_attachments': {
      const res = await extractAttachments(args.mkv_file, args.output_dir);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_run_batch': {
      const res = await runBatch(
        args.module_id,
        args.target_folder,
        args.source_folder,
        args.output_folder,
        args.options || {}
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_search_subtitles_online': {
      const res = await searchOpenSubtitles({
        apiKey: args.api_key,
        query: args.query,
        filePath: args.file_path,
        imdbId: args.imdb_id,
        tmdbId: args.tmdb_id,
        seasonNumber: args.season_number,
        episodeNumber: args.episode_number,
        languages: args.languages || 'it,en',
        type: args.type,
        hearingImpaired: args.hearing_impaired || 'include',
        orderBy: args.order_by || 'download_count',
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_download_subtitle_online': {
      const res = await downloadOpenSubtitle({
        apiKey: args.api_key,
        fileId: args.file_id,
        subFormat: args.sub_format || 'srt',
        outputPath: args.output_path,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res, null, 2),
          },
        ],
      };
    }

    case 'syncforge_auto_fetch_and_sync_subtitle': {
      // 1. Search OpenSubtitles by video file hash
      let searchRes = await searchOpenSubtitles({
        apiKey: args.api_key,
        filePath: args.video_path,
        languages: args.languages || 'it,en',
      });

      // Fallback: search by filename if hash returned no results
      if (!searchRes.subtitles || searchRes.subtitles.length === 0) {
        const base = path.basename(args.video_path).replace(/\.[^.]+$/, '');
        const cleanQuery = base
          .replace(/[._]/g, ' ')
          .replace(/(?:2160p|1080p|720p|x264|x265|hevc|web-?dl|bluray|aac|ac3).*/i, '')
          .trim();
        searchRes = await searchOpenSubtitles({
          apiKey: args.api_key,
          query: cleanQuery,
          languages: args.languages || 'it,en',
        });
      }

      if (!searchRes.subtitles || searchRes.subtitles.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'not_found',
                message: `No matching subtitles found on OpenSubtitles for "${path.basename(args.video_path)}" in languages: ${args.languages || 'it,en'}`,
              }, null, 2),
            },
          ],
        };
      }

      const bestSub = searchRes.subtitles[0];
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncforge-autofetch-'));
      const rawSubPath = path.join(tempDir, `downloaded_${bestSub.file_id}.srt`);

      try {
        // 2. Download subtitle
        await downloadOpenSubtitle({
          apiKey: args.api_key,
          fileId: bestSub.file_id,
          subFormat: 'srt',
          outputPath: rawSubPath,
        });

        // 3. Align with FFsubsync
        const syncRes = await syncSubtitles(
          args.video_path,
          rawSubPath,
          args.output_sub_path,
          args.max_offset_seconds || 60
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'ok',
                matched_subtitle: {
                  file_id: bestSub.file_id,
                  movie_name: bestSub.movie_name,
                  release: bestSub.release,
                  language: bestSub.language,
                  fps: bestSub.fps,
                  download_count: bestSub.download_count,
                  ratings: bestSub.ratings,
                },
                synchronized_output: args.output_sub_path,
                sync_log: syncRes.log,
              }, null, 2),
            },
          ],
        };
      } finally {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {}
      }
    }

    case 'syncforge_configure_opensubtitles': {
      const result = saveOpenSubtitlesConfig({
        apiKey: args.api_key,
        userToken: args.user_token,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              message: 'OpenSubtitles API credentials successfully saved to shared SyncForge configuration.',
              config_path: result.config_path,
              key_preview: args.api_key ? (args.api_key.slice(0, 4) + '...' + args.api_key.slice(-4)) : null,
              user_token_configured: Boolean(args.user_token),
            }, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
