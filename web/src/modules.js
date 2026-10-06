import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import Flag from '@mui/icons-material/Flag';
import Subtitles from '@mui/icons-material/Subtitles';
import Sync from '@mui/icons-material/Sync';
import Waves from '@mui/icons-material/Waves';
import MergeType from '@mui/icons-material/MergeType';

const modules = [
  { id: 'stream_manager', title: 'Stream Manager', desc: 'Remove unwanted audio or subtitle tracks from one video or a batch. Remux losslessly or optionally convert audio to Opus.', icon: FormatListBulleted, needs: ['video', 'output'], labels: ['Video File or Folder', '', 'Output Folder'] },
  { id: 'set_default', title: 'Set Default & Forced', desc: 'Modify the Default and Forced track flags in one MKV file or an entire batch.', icon: Flag, needs: ['video'], labels: ['Video File or Folder', '', ''] },
  { id: 'sync_subs', title: 'Sync External Subtitles', desc: 'Automatically align subtitle files to video audio with FFsubsync. Select individual files or folders.', icon: Subtitles, needs: ['video', 'sub', 'output'], labels: ['Video File or Folder', 'Subtitle File or Folder', 'Output Folder'] },
  { id: 'sync_subs_mkv', title: 'Sync Subs from MKV', desc: 'Extract subtitles from a Source MKV and realign them to the audio of a Target MKV. Select individual files or folders.', icon: Sync, needs: ['video', 'sub', 'output'], labels: ['Target Video File or Folder', 'Source Video File or Folder', 'Output Folder'] },
  { id: 'injection', title: 'WaveSync Injection', desc: 'Calculate the audio delay between source and target videos, then synchronize and inject tracks. Select individual files or folders.', icon: Waves, needs: ['video', 'sub', 'output'], labels: ['Target File or Folder (High Quality)', 'Source File or Folder (Audio/Subs)', 'Output Folder'] },
  { id: 'custom_merge', title: 'Custom Track Merge', desc: 'Combine selected tracks from two videos or batches of videos.', icon: MergeType, needs: ['video', 'sub', 'output'], labels: ['File or Folder A (Base Video)', 'File or Folder B (Additional Audio/Subs)', 'Output Folder'] }
];


export default modules;
