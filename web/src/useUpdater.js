import { useCallback, useEffect, useRef, useState } from 'react';
import { desktopBridge } from './bridge';
import packageInfo from '../package.json';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Owned by App so closing Settings never discards a download or a ready update.
export function useUpdater(autoUpdate, settingsReady) {
  const [info, setInfo] = useState(null);
  const [state, setState] = useState({ phase: 'idle' });
  const operation = useRef(false);
  const downloadedUpdate = useRef(null);

  useEffect(() => {
    let current = true;
    desktopBridge.updaterInfo().then(value => {
      if (current) setInfo(value);
    }).catch(error => {
      if (current) setState({ phase: 'error', error: String(error) });
    });
    return () => { current = false; };
  }, []);

  const check = useCallback(async () => {
    if (!info?.supported || operation.current || downloadedUpdate.current) return;
    operation.current = true;
    setState({ phase: 'checking' });
    try {
      const update = await desktopBridge.downloadUpdate(progress => {
        setState({ phase: 'downloading', ...progress });
      });
      downloadedUpdate.current = update;
      setState(update ? { phase: 'ready', ...update } : { phase: 'current', checkedAt: new Date() });
    } catch (error) {
      setState({ phase: 'error', error: String(error) });
    } finally {
      operation.current = false;
    }
  }, [info?.supported]);

  useEffect(() => {
    if (!settingsReady || !autoUpdate || !info?.supported) return;
    const initialCheck = setTimeout(check, 0);
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    return () => { clearTimeout(initialCheck); clearInterval(timer); };
  }, [autoUpdate, settingsReady, info?.supported, check]);

  const install = useCallback(async () => {
    if (!downloadedUpdate.current || operation.current) return;
    operation.current = true;
    setState({ phase: 'installing', ...downloadedUpdate.current });
    try {
      await desktopBridge.installUpdate();
    } catch (error) {
      setState({ phase: 'ready', ...downloadedUpdate.current, error: String(error) });
    } finally {
      operation.current = false;
    }
  }, []);

  return { ...state, info, currentVersion: info?.version || packageInfo.version, check, install };
}
