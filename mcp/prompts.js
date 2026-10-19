export const PROMPTS_LIST = [
  {
    name: 'inspect_and_clean_mkv',
    description: 'Inspect an MKV file, examine all video/audio/subtitle tracks, remove unwanted languages/commentaries, and set default flags.',
    arguments: [
      {
        name: 'mkv_path',
        description: 'Path to the MKV file to inspect and clean',
        required: true,
      },
      {
        name: 'preferred_audio_lang',
        description: 'Language code (e.g. "ita", "eng", "jpn") to retain or set as default audio',
        required: false,
      },
      {
        name: 'preferred_sub_lang',
        description: 'Language code (e.g. "ita", "eng") to retain or set as default subtitle',
        required: false,
      },
    ],
  },
  {
    name: 'sync_and_embed_subtitles',
    description: 'Align external subtitle files with video audio using FFsubsync and embed them into an MKV.',
    arguments: [
      {
        name: 'video_path',
        description: 'Path to the video file',
        required: true,
      },
      {
        name: 'subtitle_path',
        description: 'Path to the unsynchronized subtitle file (.srt, .ass)',
        required: true,
      },
      {
        name: 'output_path',
        description: 'Path for the final merged MKV file',
        required: true,
      },
    ],
  },
  {
    name: 'waveform_audio_sync',
    description: 'Calculate audio waveform offset between high-definition target video and a source release, align, and mux losslessly.',
    arguments: [
      {
        name: 'target_video',
        description: 'Path to high-definition target video',
        required: true,
      },
      {
        name: 'source_media',
        description: 'Path to source media containing desired audio or subtitle tracks',
        required: true,
      },
      {
        name: 'output_path',
        description: 'Path for the resulting synchronized MKV file',
        required: true,
      },
    ],
  },
];

export function getPrompt(name, args = {}) {
  switch (name) {
    case 'inspect_and_clean_mkv': {
      const mkv = args.mkv_path || '<path_to_mkv>';
      const aLang = args.preferred_audio_lang || 'specified';
      const sLang = args.preferred_sub_lang || 'specified';
      return {
        description: 'Inspect and clean MKV tracks',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please perform a thorough stream inspection and cleanup of the MKV file at "${mkv}":
1. First, call \`syncforge_inspect_media\` on "${mkv}" to retrieve all video, audio, and subtitle tracks.
2. Review the list of tracks and identify:
   - Tracks to keep (focusing on ${aLang} audio and ${sLang} subtitles).
   - Unwanted foreign tracks or commentary tracks to remove.
   - Which track should be marked as default audio and default subtitle.
3. Call \`syncforge_filter_and_clean_tracks\` to create a clean remux with only the desired tracks.
4. If necessary, call \`syncforge_set_track_flags\` to verify that the default audio and subtitle flags are set accurately.
5. Provide a clear summary of the final track layout and file size reduction.`,
            },
          },
        ],
      };
    }

    case 'sync_and_embed_subtitles': {
      const vid = args.video_path || '<path_to_video>';
      const sub = args.subtitle_path || '<path_to_sub>';
      const out = args.output_path || '<output_path>';
      return {
        description: 'Sync subtitles and embed',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please synchronize the subtitle file "${sub}" with the video audio in "${vid}" and embed it into "${out}":
1. First, call \`syncforge_sync_subtitles\` with reference_video="${vid}" and subtitle_file="${sub}" to produce a synchronized subtitle file.
2. Next, call \`syncforge_inspect_media\` on the video to inspect existing tracks.
3. Call \`syncforge_merge_tracks\` to remux the original video together with the newly synchronized subtitles into "${out}".
4. Verify the final file with \`syncforge_inspect_media\` and report the outcome.`,
            },
          },
        ],
      };
    }

    case 'waveform_audio_sync': {
      const target = args.target_video || '<target_video>';
      const source = args.source_media || '<source_media>';
      const out = args.output_path || '<output_path>';
      return {
        description: 'Waveform audio sync and merge',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please synchronize audio tracks between "${target}" and "${source}" using waveform cross-correlation and merge them into "${out}":
1. Call \`syncforge_calculate_audio_delay\` with reference_media="${target}" and source_media="${source}" to determine the precise millisecond delay.
2. Inspect both files using \`syncforge_inspect_media\` to determine the audio and subtitle track IDs to import from "${source}".
3. Call \`syncforge_merge_tracks\` passing target_video="${target}", source_media="${source}", output_mkv="${out}", and the calculated \`audio_delay_ms\`.
4. Run \`syncforge_inspect_media\` on the generated output to verify track alignment, metadata, and container integrity.`,
            },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}
