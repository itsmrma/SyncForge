import { Channel, invoke } from '@tauri-apps/api/core';

function hasTauri() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

function getMockApi() {
  if (typeof window !== 'undefined' && window.pywebview && window.pywebview.api) {
    return window.pywebview.api;
  }
  return null;
}

export const desktopBridge = {
  async updaterInfo() {
    const mock = getMockApi();
    if (mock?.updater_info) return await mock.updater_info();
    if (hasTauri()) return await invoke('updater_info');
    return { supported: false, platform: 'browser' };
  },

  async downloadUpdate(onProgress) {
    const mock = getMockApi();
    if (mock?.download_update) return await mock.download_update(onProgress);
    if (!hasTauri()) throw new Error('The desktop backend is not connected.');
    const channel = new Channel();
    channel.onmessage = onProgress;
    return await invoke('download_update', { onProgress: channel });
  },

  async installUpdate() {
    const mock = getMockApi();
    if (mock?.install_update) return await mock.install_update();
    if (!hasTauri()) throw new Error('The desktop backend is not connected.');
    return await invoke('install_update');
  },

  isConnected() {
    return Boolean(getMockApi() || hasTauri());
  },

  async runModule(moduleName, settings, paths, repeat) {
    const mock = getMockApi();
    if (mock && mock.run_module) {
      return await mock.run_module(moduleName, settings, paths, repeat);
    }
    if (hasTauri()) {
      return await invoke('run_module', {
        moduleName,
        settings,
        paths,
        repeat,
      });
    }
    throw new Error('The desktop backend is not connected.');
  },

  async stopTask() {
    const mock = getMockApi();
    if (mock && mock.stop_task) {
      return await mock.stop_task();
    }
    if (hasTauri()) {
      return await invoke('stop_task');
    }
    return { status: 'idle' };
  },

  async resolveInput(callbackId, result) {
    const mock = getMockApi();
    if (mock && mock.resolve_input) {
      return await mock.resolve_input(callbackId, result);
    }
    if (hasTauri()) {
      return await invoke('resolve_input', { callbackId, result });
    }
  },

  async resolveMatcher(callbackId, res, sourceOrder) {
    const mock = getMockApi();
    if (mock && mock.resolve_matcher) {
      if (sourceOrder !== undefined) {
        return await mock.resolve_matcher(callbackId, res, sourceOrder);
      }
      return await mock.resolve_matcher(callbackId, res);
    }
    if (hasTauri()) {
      return await invoke('resolve_matcher', {
        callbackId,
        res,
        sourceOrder: sourceOrder ?? null,
      });
    }
  },

  async pickFile(mediaType, defaultPath) {
    const mock = getMockApi();
    if (mock && mock.pick_file) {
      return await mock.pick_file(mediaType, defaultPath);
    }
    if (hasTauri()) {
      return await invoke('pick_file', {
        mediaType,
        defaultPath: defaultPath || null,
      });
    }
    return '';
  },

  async pickFolder(defaultPath) {
    const mock = getMockApi();
    if (mock && mock.pick_folder) {
      return await mock.pick_folder(defaultPath);
    }
    if (hasTauri()) {
      return await invoke('pick_folder', {
        defaultPath: defaultPath || null,
      });
    }
    return '';
  },

  async saveLogs(content, defaultName) {
    const mock = getMockApi();
    if (mock && mock.save_logs) {
      return await mock.save_logs(content, defaultName);
    }
    if (hasTauri()) {
      return await invoke('save_logs', { content, defaultName });
    }
    throw new Error('The desktop backend is not connected.');
  },

  async showInFolder(path) {
    const mock = getMockApi();
    if (mock && mock.show_in_folder) {
      return await mock.show_in_folder(path);
    }
    if (hasTauri()) {
      return await invoke('show_in_folder', { path });
    }
  },

  async inspectMedia(path) {
    const mock = getMockApi();
    if (mock && mock.inspect_media) {
      return await mock.inspect_media(path);
    }
    if (hasTauri() && typeof window.__TAURI_INTERNALS__?.transformCallback === 'function') {
      return await invoke('inspect_media', { path });
    }
    return null;
  },

  async previewSyncMpv({
    target,
    audioFile = null,
    audioDelayMs = 0,
    subFile = null,
    subDelayMs = 0,
    startTime = null,
  }) {
    const mock = getMockApi();
    if (mock && mock.preview_sync_mpv) {
      return await mock.preview_sync_mpv({
        target,
        audioFile,
        audioDelayMs,
        subFile,
        subDelayMs,
        startTime,
      });
    }
    if (hasTauri()) {
      return await invoke('preview_sync_mpv', {
        target,
        audioFile,
        audioDelayMs,
        subFile,
        subDelayMs,
        startTime,
      });
    }
    return { status: 'mock_launched', target, audioFile, audioDelayMs, subFile, subDelayMs, startTime };
  },

  async saveSettings(settings) {
    const mock = getMockApi();
    if (mock && mock.save_settings) {
      return await mock.save_settings(settings);
    }
    if (hasTauri()) {
      return await invoke('save_settings', { settings });
    }
  },

  async loadSettings() {
    const mock = getMockApi();
    if (mock && mock.load_settings) {
      return await mock.load_settings();
    }
    if (hasTauri()) {
      return await invoke('load_settings');
    }
    return null;
  },

  async checkExternalTools() {
    const mock = getMockApi();
    if (mock && mock.check_external_tools) {
      return await mock.check_external_tools();
    }
    if (hasTauri()) {
      return await invoke('check_external_tools');
    }
    return {
      mkvmerge: { name: 'mkvmerge', found: true, path: 'mkvmerge' },
      mkvextract: { name: 'mkvextract', found: true, path: 'mkvextract' },
      mkvpropedit: { name: 'mkvpropedit', found: true, path: 'mkvpropedit' },
      ffmpeg: { name: 'ffmpeg', found: true, path: 'ffmpeg' },
      ffsubsync: { name: 'ffsubsync', found: true, path: 'ffsubsync' },
      mpv: { name: 'mpv', found: true, path: 'mpv' },
    };
  },
};
