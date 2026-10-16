import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import DragHandle from '@mui/icons-material/DragHandle';
import { Reorder } from 'framer-motion';

const formatPath = (path) => path.split(/[\\/]/).at(-1);

export default function MatcherDialog({
  state,
  sources,
  onReorder,
  onCancel,
  onConfirm,
  onStop,
  stopping,
}) {
  return (
    <Dialog open={state.open} onClose={onCancel} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Pairing Screen (Drag & Drop)
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(148, 163, 184, 0.12)' }}>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Drag the source files on the right to match the correct target files on the left.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Targets
            </Typography>
            <List dense sx={{ p: 0 }}>
              {state.targets.map((t, idx) => (
                <ListItem
                  key={idx}
                  sx={{
                    bgcolor: '#0B0F18',
                    border: '1px solid rgba(148, 163, 184, 0.14)',
                    mb: 1,
                    borderRadius: 1.5,
                    height: 46,
                    p: 1.25,
                    overflow: 'hidden',
                  }}
                >
                  <Tooltip title={formatPath(t)} placement="left" arrow>
                    <Typography variant="body2" noWrap sx={{ fontFamily: 'monospace' }}>
                      {formatPath(t)}
                    </Typography>
                  </Tooltip>
                </ListItem>
              ))}
            </List>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
              Sources (Drag to reorder)
            </Typography>
            <Reorder.Group
              axis="y"
              values={sources}
              onReorder={onReorder}
              style={{ listStyleType: 'none', padding: 0, margin: 0 }}
            >
              {sources.map((s) => (
                <Reorder.Item
                  key={s.id}
                  value={s}
                  style={{ marginBottom: 8, height: 46, cursor: 'grab' }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 1.25,
                      bgcolor: 'rgba(99, 102, 241, 0.16)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: 'text.primary',
                      height: '100%',
                      borderRadius: 1.5,
                      overflow: 'hidden',
                    }}
                  >
                    <DragHandle sx={{ mr: 1, opacity: 0.7, flexShrink: 0, color: '#818CF8' }} />
                    <Tooltip title={formatPath(s.path)} placement="right" arrow>
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ minWidth: 0, fontFamily: 'monospace' }}
                      >
                        {formatPath(s.path)}
                      </Typography>
                    </Tooltip>
                  </Paper>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onStop} color="error" disabled={stopping}>
          {stopping ? 'Stopping...' : 'Stop task'}
        </Button>
        <Button onClick={onCancel} color="error">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained">
          Confirm Pairing
        </Button>
      </DialogActions>
    </Dialog>
  );
}
