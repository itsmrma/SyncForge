use rustfft::num_complex::Complex;
use rustfft::FftPlanner;

use crate::core::config::MAX_AUDIO_DELAY_MS;
use crate::core::tasks::{check_cancelled, TaskError};
use crate::core::utils::run_subprocess;

pub fn extract_audio_segment(
    input_file: &str,
    output_wav: &str,
    start_time: &str,
    duration: &str,
) -> Result<(), TaskError> {
    let cmd = vec![
        "ffmpeg".to_string(),
        "-y".to_string(),
        "-ss".to_string(),
        start_time.to_string(),
        "-t".to_string(),
        duration.to_string(),
        "-i".to_string(),
        input_file.to_string(),
        "-ac".to_string(),
        "1".to_string(),
        "-ar".to_string(),
        "8000".to_string(),
        "-c:a".to_string(),
        "pcm_s16le".to_string(),
        output_wav.to_string(),
    ];
    run_subprocess(&cmd, None)?;
    Ok(())
}

fn read_wav_samples(path: &str) -> Result<(u32, Vec<f32>), String> {
    let mut reader = hound::WavReader::open(path).map_err(|e| e.to_string())?;
    let spec = reader.spec();
    let sample_rate = spec.sample_rate;
    let channels = spec.channels.max(1) as usize;

    let raw_samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            if spec.bits_per_sample <= 16 {
                reader
                    .samples::<i16>()
                    .collect::<Result<Vec<i16>, _>>()
                    .map_err(|e| e.to_string())?
                    .into_iter()
                    .map(|s| s as f32)
                    .collect()
            } else {
                reader
                    .samples::<i32>()
                    .collect::<Result<Vec<i32>, _>>()
                    .map_err(|e| e.to_string())?
                    .into_iter()
                    .map(|s| s as f32)
                    .collect()
            }
        }
        hound::SampleFormat::Float => reader
            .samples::<f32>()
            .collect::<Result<Vec<f32>, _>>()
            .map_err(|e| e.to_string())?,
    };

    let mono: Vec<f32> = if channels == 1 {
        raw_samples
    } else {
        raw_samples
            .chunks(channels)
            .map(|c| c.iter().sum::<f32>() / c.len() as f32)
            .collect()
    };

    Ok((sample_rate, mono))
}

fn std_dev(data: &[f32]) -> f32 {
    if data.is_empty() {
        return 0.0;
    }
    let n = data.len() as f64;
    let mean = data.iter().map(|&x| x as f64).sum::<f64>() / n;
    let var = data
        .iter()
        .map(|&x| {
            let d = x as f64 - mean;
            d * d
        })
        .sum::<f64>()
        / n;
    var.sqrt() as f32
}

pub fn find_audio_delay(ref_wav: &str, src_wav: &str) -> Result<i64, TaskError> {
    check_cancelled()?;

    let (fs_ref, data_ref) = read_wav_samples(ref_wav)
        .map_err(|e| TaskError::Message(format!("Audio analysis failed: {}", e)))?;
    let (fs_src, data_src) = read_wav_samples(src_wav)
        .map_err(|e| TaskError::Message(format!("Audio analysis failed: {}", e)))?;

    if fs_ref != fs_src {
        return Err(TaskError::Message(
            "Audio analysis failed: Audio sample rates do not match".to_string(),
        ));
    }

    let std_ref = std_dev(&data_ref);
    let std_src = std_dev(&data_src);

    if data_ref.is_empty() || data_src.is_empty() || std_ref == 0.0 || std_src == 0.0 {
        return Err(TaskError::Message(
            "Audio analysis failed: No usable audio in the analysis segment".to_string(),
        ));
    }

    let norm_ref: Vec<f32> = data_ref.iter().map(|&v| v / (std_ref + 1e-6)).collect();
    let norm_src: Vec<f32> = data_src.iter().map(|&v| v / (std_src + 1e-6)).collect();

    let n_ref = norm_ref.len();
    let n_src = norm_src.len();
    let full_len = n_ref + n_src - 1;
    let fft_len = full_len.next_power_of_two();

    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(fft_len);
    let ifft = planner.plan_fft_inverse(fft_len);

    let mut buf_ref = vec![Complex::new(0.0f32, 0.0f32); fft_len];
    for (i, &val) in norm_ref.iter().enumerate() {
        buf_ref[i].re = val;
    }

    // Cross-correlation correlate(ref, src, mode='full') == convolve(ref, src[::-1], mode='full')
    let mut buf_src = vec![Complex::new(0.0f32, 0.0f32); fft_len];
    for (i, &val) in norm_src.iter().rev().enumerate() {
        buf_src[i].re = val;
    }

    fft.process(&mut buf_ref);
    fft.process(&mut buf_src);

    for (a, b) in buf_ref.iter_mut().zip(buf_src.iter()) {
        *a *= *b;
    }

    ifft.process(&mut buf_ref);
    check_cancelled()?;

    let max_lag_samples = ((MAX_AUDIO_DELAY_MS as f64 / 1000.0) * (fs_ref as f64)) as i64;

    let mut best_val = f32::NEG_INFINITY;
    let mut best_lag: Option<i64> = None;

    for idx in 0..full_len {
        let lag = (idx as i64) - (n_src as i64 - 1);
        if lag.abs() <= max_lag_samples {
            let val = buf_ref[idx].re;
            if val > best_val {
                best_val = val;
                best_lag = Some(lag);
            }
        }
    }

    let Some(lag) = best_lag else {
        return Ok(0);
    };

    let delay_ms = ((lag as f64 / fs_ref as f64) * 1000.0).trunc() as i64;
    Ok(delay_ms)
}
