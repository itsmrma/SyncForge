import { invoke } from '@tauri-apps/api/core';

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

  async pickFile(mediaType) {
    const mock = getMockApi();
    if (mock && mock.pick_file) {
      return await mock.pick_file(mediaType);
    }
    if (hasTauri()) {
      return await invoke('pick_file', { mediaType });
    }
    return '';
  },

  async pickFolder() {
    const mock = getMockApi();
    if (mock && mock.pick_folder) {
      return await mock.pick_folder();
    }
    if (hasTauri()) {
      return await invoke('pick_folder');
    }
    return '';
  },
};
