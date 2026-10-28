function quoteShellArg(val, shell) {
  const s = String(val ?? '');
  if (/^[a-zA-Z0-9_./:-]+$/.test(s)) return s;
  // Single-quoted literals prevent expansion and keep backslashes literal.
  if (shell === 'powershell') return "'" + s.replace(/['\u2018\u2019]/g, '$&$&') + "'";
  return "'" + s.replace(/'/g, "'\"'\"'") + "'";
}

export function buildCliCommandAndScript(selectedMod, paths, settings, extraOpts = {}) {
  const modId = selectedMod?.id || 'stream_manager';
  const vid = (paths?.video || '').trim() || './input_video';
  const sub = (paths?.sub || '').trim() || './input_source';
  const out = (paths?.output || settings?.default_output_dir || '').trim();

  const nonInteractive = extraOpts.yes ?? true;
  const args = ['syncforge-cli', 'run', modId];
  const scriptObj = {
    module: modId,
    video: vid,
  };

  args.push('-v', vid);

  if (selectedMod?.needs?.includes('sub')) {
    args.push('-s', sub);
    scriptObj.sub = sub;
  }

  if (selectedMod?.needs?.includes('output') && out) {
    args.push('-o', out);
    scriptObj.output = out;
  }

  // Applicable settings per AGENTS.md matrix
  if (['stream_manager', 'injection', 'custom_merge', 'internal_sync'].includes(modId)) {
    const opusMode = settings?.opus_mode || 'off';
    if (opusMode !== 'off') {
      args.push('--opus', opusMode);
      args.push('--opus-bitrate', String(settings?.opus_bitrate || 128));
      if (settings?.opus_downmix === false) {
        args.push('--no-opus-downmix');
      }
      scriptObj.opus_mode = opusMode;
      scriptObj.opus_bitrate = Number(settings?.opus_bitrate || 128);
      scriptObj.opus_downmix = settings?.opus_downmix !== false;
    }
  }

  if (['injection', 'internal_sync'].includes(modId)) {
    if (settings?.auto_audio === false) {
      args.push('--no-auto-audio');
      scriptObj.auto_audio = false;
    }
  }

  if (['sync_subs', 'sync_subs_mkv', 'injection', 'internal_sync'].includes(modId)) {
    if (settings?.auto_subs === false) {
      args.push('--no-auto-subs');
      scriptObj.auto_subs = false;
    }
    if (settings?.enable_max_offset && Number(settings?.max_offset) > 0) {
      args.push('--max-offset', String(settings.max_offset));
      scriptObj.enable_max_offset = true;
      scriptObj.max_offset = Number(settings.max_offset);
    }
  }

  // Module-specific optional flags
  if (modId === 'stream_manager') {
    if (extraOpts.keepTracks?.trim()) {
      const kt = extraOpts.keepTracks.trim();
      args.push('--keep-tracks', kt);
      scriptObj.keep_tracks = kt;
    }
    if (extraOpts.keepAudio?.trim()) {
      const ka = extraOpts.keepAudio.trim();
      args.push('--keep-audio', ka);
      scriptObj.keep_audio = ka;
    }
    if (extraOpts.keepSubs?.trim()) {
      const ks = extraOpts.keepSubs.trim();
      args.push('--keep-subs', ks);
      scriptObj.keep_subs = ks;
    }
  }

  if (modId === 'set_default') {
    if (extraOpts.defaultAudio?.trim()) {
      args.push('--default-audio', extraOpts.defaultAudio.trim());
      scriptObj.default_audio = extraOpts.defaultAudio.trim();
    }
    if (extraOpts.defaultSub?.trim()) {
      args.push('--default-sub', extraOpts.defaultSub.trim());
      scriptObj.default_sub = extraOpts.defaultSub.trim();
    }
    if (extraOpts.forcedSub?.trim()) {
      args.push('--forced-sub', extraOpts.forcedSub.trim());
      scriptObj.forced_sub = extraOpts.forcedSub.trim();
    }
  }

  if (modId === 'sync_subs_mkv' && extraOpts.subTrack?.trim()) {
    args.push('--sub-track', extraOpts.subTrack.trim());
    scriptObj.sub_track = extraOpts.subTrack.trim();
  }

  if (modId === 'injection') {
    if (extraOpts.keepTargetAudio) {
      args.push('--keep-target-audio');
      scriptObj.keep_target_audio = true;
    }
    if (extraOpts.keepTargetSubs) {
      args.push('--keep-target-subs');
      scriptObj.keep_target_subs = true;
    }
    if (extraOpts.audioTrack?.trim()) {
      args.push('--import-audio', '--audio-track', extraOpts.audioTrack.trim());
      scriptObj.import_audio = true;
      scriptObj.audio_track = extraOpts.audioTrack.trim();
    }
    if (extraOpts.subTrack?.trim()) {
      args.push('--import-subs', '--sub-track', extraOpts.subTrack.trim());
      scriptObj.import_subs = true;
      scriptObj.sub_track = extraOpts.subTrack.trim();
    }
  }

  if (modId === 'custom_merge') {
    if (extraOpts.keepAAudio?.trim()) {
      args.push('--keep-a-audio', extraOpts.keepAAudio.trim());
      scriptObj.keep_a_audio = extraOpts.keepAAudio.trim();
    }
    if (extraOpts.keepASubs?.trim()) {
      args.push('--keep-a-subs', extraOpts.keepASubs.trim());
      scriptObj.keep_a_subs = extraOpts.keepASubs.trim();
    }
    if (extraOpts.keepBAudio?.trim()) {
      args.push('--keep-b-audio', extraOpts.keepBAudio.trim());
      scriptObj.keep_b_audio = extraOpts.keepBAudio.trim();
    }
    if (extraOpts.keepBSubs?.trim()) {
      args.push('--keep-b-subs', extraOpts.keepBSubs.trim());
      scriptObj.keep_b_subs = extraOpts.keepBSubs.trim();
    }
  }

  if (modId === 'internal_sync') {
    if (extraOpts.refAudioTrack?.trim()) {
      args.push('--ref-audio-track', extraOpts.refAudioTrack.trim());
      scriptObj.ref_audio_track = extraOpts.refAudioTrack.trim();
    }
    if (extraOpts.audioTrack?.trim()) {
      args.push('--sync-audio', '--target-audio-track', extraOpts.audioTrack.trim());
      scriptObj.sync_audio = true;
      scriptObj.target_audio_track = extraOpts.audioTrack.trim();
    }
    if (extraOpts.subTrack?.trim()) {
      args.push('--sync-subs', '--target-sub-track', extraOpts.subTrack.trim());
      scriptObj.sync_subs = true;
      scriptObj.target_sub_track = extraOpts.subTrack.trim();
    }
  }

  if (nonInteractive) {
    args.push('-y');
    scriptObj.yes = true;
  }

  return {
    command: args.map(arg => quoteShellArg(arg, extraOpts.shell ?? 'bash')).join(' '),
    scriptJson: JSON.stringify({ jobs: [scriptObj] }, null, 2),
  };
}

