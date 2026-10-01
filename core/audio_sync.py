from core.utils import HAS_SCIPY, run_subprocess
from core.tasks import check_cancelled, TaskCancelled

MAX_AUDIO_DELAY_MS = 3000

def extract_audio_segment(input_file, output_wav, start_time="00:05:00", duration="00:02:00"):
    cmd = [
        "ffmpeg", "-y", 
        "-ss", start_time, "-t", duration,
        "-i", input_file,
        "-ac", "1",      
        "-ar", "8000",   
        "-c:a", "pcm_s16le", 
        output_wav
    ]
    run_subprocess(cmd)

def find_audio_delay(ref_wav, src_wav):
    check_cancelled()
    if not HAS_SCIPY: return 0
    try:
        # Lazy Loading imports to drastically speed up app startup
        import numpy as np
        from scipy import signal
        from scipy.io import wavfile

        fs_ref, data_ref = wavfile.read(ref_wav)
        fs_src, data_src = wavfile.read(src_wav)

        if fs_ref != fs_src:
            raise ValueError('Audio sample rates do not match')
        if not data_ref.size or not data_src.size or not np.std(data_ref) or not np.std(data_src):
            raise ValueError('No usable audio in the analysis segment')

        data_ref = data_ref.astype(np.float32) / (np.std(data_ref) + 1e-6)
        data_src = data_src.astype(np.float32) / (np.std(data_src) + 1e-6)

        correlation = signal.correlate(data_ref, data_src, mode='full', method='fft')
        check_cancelled()
        lags = signal.correlation_lags(data_ref.size, data_src.size, mode='full')
        
        max_lag_samples = int((MAX_AUDIO_DELAY_MS / 1000.0) * fs_ref)
        valid_indices = np.where(np.abs(lags) <= max_lag_samples)[0]
        
        if len(valid_indices) == 0: return 0
            
        valid_correlation = correlation[valid_indices]
        valid_lags = lags[valid_indices]
        
        best_idx = np.argmax(valid_correlation)
        best_lag = valid_lags[best_idx]
        
        delay_ms = int((best_lag / fs_ref) * 1000)
        return delay_ms
    except TaskCancelled:
        raise
    except Exception as e:
        raise RuntimeError(f"Audio analysis failed: {e}") from e
