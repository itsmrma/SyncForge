import { createTheme } from '@mui/material';

export default createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#D0BCFF' },
    background: { default: '#141218', paper: '#211F26' },
    text: { primary: '#E6E0E9', secondary: '#CAC4D0' }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  }
});
