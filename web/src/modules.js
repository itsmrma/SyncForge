import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import Flag from '@mui/icons-material/Flag';
import Subtitles from '@mui/icons-material/Subtitles';
import Sync from '@mui/icons-material/Sync';
import Waves from '@mui/icons-material/Waves';
import MergeType from '@mui/icons-material/MergeType';

const modules = [
  { id: 'stream_manager', title: 'Remove & Filter Tracks', desc: 'Remove unwanted audio or subtitle tracks from one video or a batch. Remux losslessly or optionally convert audio to Opus.', icon: FormatListBulleted, needs: ['video', 'output'], labels: ['Video File or Folder', '', 'Output Folder'] },
  { id: 'set_default', title: 'Set Default & Forced Flags', desc: 'Modify Default and Forced track metadata flags in MKV files directly without remuxing.', icon: Flag, needs: ['video'], labels: ['Video File or Folder', '', ''] },
  { id: 'sync_subs', title: 'Sync Subtitle Files to Audio', desc: 'Automatically align external subtitle files (.srt, .ass) to video speech/audio with FFsubsync.', icon: Subtitles, needs: ['video', 'sub', 'output'], labels: ['Video File or Folder', 'Subtitle File or Folder', 'Output Folder'] },
  { id: 'sync_subs_mkv', title: 'Extract & Sync Subs from MKV', desc: 'Extract subtitles from a Source MKV and realign them to the audio of a Target MKV.', icon: Sync, needs: ['video', 'sub', 'output'], labels: ['Target Video File or Folder', 'Source Video File or Folder', 'Output Folder'] },
  { id: 'injection', title: 'Waveform Audio Sync & Merge', desc: 'Calculate audio waveform delay between source and target videos, synchronize tracks, and merge them losslessly.', icon: Waves, needs: ['video', 'sub', 'output'], labels: ['Target File or Folder (High Quality)', 'Source File or Folder (Audio/Subs)', 'Output Folder'] },
  { id: 'custom_merge', title: 'Direct Track Merge (No Sync)', desc: 'Combine selected tracks from two videos or batches without re-syncing (direct lossless remux).', icon: MergeType, needs: ['video', 'sub', 'output'], labels: ['File or Folder A (Base Video)', 'File or Folder B (Additional Audio/Subs)', 'Output Folder'] }
];


export default modules;
