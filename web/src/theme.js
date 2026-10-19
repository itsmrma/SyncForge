import { createTheme } from '@mui/material';

export function getAppTheme(mode = 'dark') {
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode: isLight ? 'light' : 'dark',
      primary: {
        main: '#4F46E5',
        light: isLight ? '#6366F1' : '#818CF8',
        dark: isLight ? '#4338CA' : '#3730A3',
        contrastText: '#F8FAFC',
      },
      secondary: {
        main: isLight ? '#0284C7' : '#38BDF8',
      },
      error: {
        main: isLight ? '#E11D48' : '#F43F5E',
      },
      warning: {
        main: isLight ? '#D97706' : '#F59E0B',
      },
      success: {
        main: isLight ? '#059669' : '#10B981',
      },
      info: {
        main: isLight ? '#0284C7' : '#38BDF8',
      },
      background: {
        default: isLight ? '#F1F3F7' : '#090C12',
        paper: isLight ? '#FAFAFC' : '#0F141F',
      },
      text: {
        primary: isLight ? '#0F172A' : '#F1F5F9',
        secondary: isLight ? '#475569' : '#94A3B8',
        disabled: isLight ? '#94A3B8' : '#475569',
      },
      divider: isLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(148, 163, 184, 0.12)',
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
            '&:focus-visible': {
              outline: isLight ? '2px solid #4F46E5' : '2px solid #818CF8',
              outlineOffset: 2,
              boxShadow: isLight
                ? '0 0 0 4px rgba(79, 70, 229, 0.18)'
                : '0 0 0 4px rgba(99, 102, 241, 0.25)',
            },
          },
          containedPrimary: {
            background: isLight
              ? 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)'
              : 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
            border: isLight
              ? '1px solid rgba(67, 56, 202, 0.4)'
              : '1px solid rgba(129, 140, 248, 0.35)',
            '&:hover': {
              background: isLight
                ? 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)'
                : 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
            },
          },
          outlined: {
            borderColor: isLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(148, 163, 184, 0.2)',
            backgroundColor: isLight ? '#FAFAFC' : 'rgba(15, 20, 31, 0.6)',
            color: isLight ? '#0F172A' : '#F1F5F9',
            '&:hover': {
              borderColor: isLight ? 'rgba(79, 70, 229, 0.45)' : 'rgba(129, 140, 248, 0.45)',
              backgroundColor: isLight ? 'rgba(79, 70, 229, 0.06)' : 'rgba(99, 102, 241, 0.08)',
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isLight ? '#FAFAFC' : '#0F141F',
            border: isLight
              ? '1px solid rgba(15, 23, 42, 0.12)'
              : '1px solid rgba(148, 163, 184, 0.16)',
            boxShadow: isLight
              ? '0 20px 40px rgba(15, 23, 42, 0.16)'
              : '0 24px 48px rgba(0, 0, 0, 0.65)',
            borderRadius: 12,
          },
        },
      },
      MuiCheckbox: {
        defaultProps: {
          disableRipple: true,
        },
        styleOverrides: {
          root: {
            transition: 'none !important',
            '& .MuiSvgIcon-root': {
              transition: 'none !important',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? '#E8ECF2' : '#0B0F18',
            borderRadius: 8,
            '& fieldset': {
              borderColor: isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(148, 163, 184, 0.16)',
            },
            '&:hover fieldset': {
              borderColor: isLight ? 'rgba(15, 23, 42, 0.28)' : 'rgba(148, 163, 184, 0.32)',
            },
            '&.Mui-focused fieldset': {
              borderColor: isLight ? '#4F46E5' : '#6366F1',
              borderWidth: 1.5,
            },
          },
        },
      },
    },
  });
}

export default getAppTheme('dark');
