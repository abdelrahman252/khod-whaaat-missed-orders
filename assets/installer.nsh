!macro customInit
  ; Remove stale shortcuts so the update leaves one current KHOD entry.
  Delete "$DESKTOP\KHOD WHAAT Orders.lnk"
  Delete "$SMPROGRAMS\KHOD WHAAT Orders.lnk"
!macroend

!macro customInstall
  ; Recreate shortcuts pointing at the newly installed executable.
  CreateShortCut "$DESKTOP\KHOD WHAAT Orders.lnk" "$appExe" "" "$appExe" 0
  CreateShortCut "$SMPROGRAMS\KHOD WHAAT Orders.lnk" "$appExe" "" "$appExe" 0

  ; Ask Windows Explorer to refresh shortcut/icon associations immediately.
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
