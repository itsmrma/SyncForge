import subprocess
from core.utils import HAS_SCIPY

if HAS_SCIPY:
    import numpy as np
    from scipy import signal
    from scipy.io import wavfile

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
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def find_audio_delay(ref_wav, src_wav):
    if not HAS_SCIPY: return 0
    try:
        fs_ref, data_ref = wavfile.read(ref_wav)
        fs_src, data_src = wavfile.read(src_wav)

        if fs_ref != fs_src: return 0

        data_ref = data_ref.astype(np.float32) / (np.std(data_ref) + 1e-6)
        data_src = data_src.astype(np.float32) / (np.std(data_src) + 1e-6)

        correlation = signal.correlate(data_ref, data_src, mode='full', method='fft')
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
    except Exception as e:
        print(f"   [AudioAnalysis Error] {e}")
        return 0
