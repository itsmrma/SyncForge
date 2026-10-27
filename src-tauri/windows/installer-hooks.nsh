; A portable executable never receives this marker, so it cannot launch an installer update.
!macro NSIS_HOOK_POSTINSTALL
  FileOpen $0 "$INSTDIR\syncforge-installed" w
  FileWrite $0 "SyncForge NSIS installation"
  FileClose $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$INSTDIR\syncforge-installed"
!macroend
