import { createTheme } from '@mui/material';

export default createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366F1',
      light: '#818CF8',
      dark: '#4F46E5',
      contrastText: '#F8FAFC',
    },
    secondary: {
      main: '#38BDF8',
    },
    error: {
      main: '#F43F5E',
    },
    warning: {
      main: '#F59E0B',
    },
    success: {
      main: '#10B981',
    },
    info: {
      main: '#38BDF8',
    },
    background: {
      default: '#090C12',
      paper: '#0F141F',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
      disabled: '#475569',
    },
    divider: 'rgba(148, 163, 184, 0.12)',
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h3: {
      fontSize: '1.85rem',
      fontWeight: 800,
      letterSpacing: '-0.025em',
    },
    h5: {
      fontSize: '1.15rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
          border: '1px solid rgba(129, 140, 248, 0.35)',
          '&:hover': {
            background: 'linear-gradient(135deg, #818CF8 0%, #6366F1 100%)',
          },
        },
        outlined: {
          borderColor: 'rgba(148, 163, 184, 0.2)',
          backgroundColor: 'rgba(15, 20, 31, 0.6)',
          '&:hover': {
            borderColor: 'rgba(129, 140, 248, 0.45)',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: '#0F141F',
          border: '1px solid rgba(148, 163, 184, 0.16)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65)',
          borderRadius: 12,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#0B0F18',
          borderRadius: 8,
          '& fieldset': {
            borderColor: 'rgba(148, 163, 184, 0.16)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(148, 163, 184, 0.32)',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#6366F1',
            borderWidth: 1.5,
          },
        },
      },
    },
  },
});
