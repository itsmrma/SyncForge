import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, Paper, Tooltip, Typography } from '@mui/material';
import DragHandle from '@mui/icons-material/DragHandle';
import { Reorder } from 'framer-motion';

const formatPath = path => path.split(/[\\/]/).at(-1);

export default function MatcherDialog({ state, sources, onReorder, onCancel, onConfirm, onStop, stopping }) {
  return (
    <Dialog open={state.open} onClose={onCancel} maxWidth="xl" fullWidth>
      <DialogTitle>Pairing Screen (Drag & Drop)</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Drag the source files on the right to match the correct target files on the left.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Targets</Typography>
              <List dense sx={{ p: 0 }}>
                  {state.targets.map((t, idx) => (
                      <ListItem key={idx} sx={{ bgcolor: 'rgba(255,255,255,0.05)', mb: 1, borderRadius: 1, height: 48, p: 1, overflow: 'hidden' }}>
                          <Tooltip title={formatPath(t)} placement="left" arrow>
                            <Typography variant="body2" noWrap>{formatPath(t)}</Typography>
                          </Tooltip>
                      </ListItem>
                  ))}
              </List>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Sources (Drag to reorder)</Typography>
              <Reorder.Group axis="y" values={sources} onReorder={onReorder} style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                  {sources.map((s) => (
                      <Reorder.Item key={s.id} value={s} style={{ marginBottom: 8, height: 48, cursor: 'grab' }}>
                          <Paper sx={{ display: 'flex', alignItems: 'center', p: 1, bgcolor: 'primary.dark', color: 'primary.contrastText', height: '100%', overflow: 'hidden' }}>
                              <DragHandle sx={{ mr: 1, opacity: 0.7, flexShrink: 0 }} />
                              <Tooltip title={formatPath(s.path)} placement="right" arrow>
                                <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{formatPath(s.path)}</Typography>
                              </Tooltip>
                          </Paper>
                      </Reorder.Item>
                  ))}
              </Reorder.Group>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onStop} color="error" disabled={stopping}>{stopping ? 'Stopping...' : 'Stop task'}</Button>
        <Button onClick={onCancel} color="error">Cancel</Button>
        <Button onClick={onConfirm} variant="contained">Confirm Pairing</Button>
      </DialogActions>
    </Dialog>
  );
}
