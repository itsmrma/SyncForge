import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import Flag from '@mui/icons-material/Flag';
import Subtitles from '@mui/icons-material/Subtitles';
import Sync from '@mui/icons-material/Sync';
import Waves from '@mui/icons-material/Waves';
import MergeType from '@mui/icons-material/MergeType';

const modules = [
  { id: 'stream_manager', title: 'Stream Manager', desc: 'Batch-remove unwanted audio or subtitle tracks. The operation is lossless and instantaneous.', icon: FormatListBulleted, needs: ['video', 'output'], labels: ['Video Folder', '', 'Output Folder'] },
  { id: 'set_default', title: 'Set Default & Forced', desc: 'Modify the Default and Forced track flags across an entire batch of MKV files.', icon: Flag, needs: ['video'], labels: ['Video Folder', '', ''] },
  { id: 'sync_subs', title: 'Sync External Subtitles', desc: 'Automatically align your .srt files to the video\'s audio track. Leverages FFsubsync.', icon: Subtitles, needs: ['video', 'sub', 'output'], labels: ['Video Folder', 'Subtitle Folder', 'Output Folder'] },
  { id: 'sync_subs_mkv', title: 'Sync Subs from MKV', desc: 'Automatically extracts subtitles from a Source MKV and realigns them to the audio of a Target MKV.', icon: Sync, needs: ['video', 'sub', 'output'], labels: ['Target Video Folder', 'Source Video Folder', 'Output Folder'] },
  { id: 'injection', title: 'WaveSync Injection', desc: 'Automatically calculates the exact delay between the audio of two different video files. Syncs and injects.', icon: Waves, needs: ['video', 'sub', 'output'], labels: ['Target Folder (High Quality)', 'Source Folder (Extract audio/subs)', 'Output Folder'] },
  { id: 'custom_merge', title: 'Custom Track Merge', desc: 'Combine specific tracks from two different batches of videos to create the ultimate hybrid file.', icon: MergeType, needs: ['video', 'sub', 'output'], labels: ['Folder A (Base Video)', 'Folder B (Additional Audio/Subs)', 'Output Folder'] }
];


export default modules;
