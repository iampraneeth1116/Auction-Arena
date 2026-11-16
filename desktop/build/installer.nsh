; Additions to the Windows installer (electron-builder includes this file, see nsis.include).
; Invite links (auctionarena://lobby/AB12CD) open the app from the moment it's installed, not only
; after its first start, and stop pointing at it once it's uninstalled. The app also registers
; them itself every time it starts (main.js), which keeps the path right.

!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\auctionarena" "" "URL:Auction Arena invite link"
  WriteRegStr SHELL_CONTEXT "Software\Classes\auctionarena" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\auctionarena\DefaultIcon" "" "$appExe,0"
  WriteRegStr SHELL_CONTEXT "Software\Classes\auctionarena\shell\open\command" "" '"$appExe" "%1"'
!macroend

!macro customUnInstall
  ; An update runs the old version's uninstaller first: the links stay through it
  ${ifNot} ${isUpdated}
    DeleteRegKey SHELL_CONTEXT "Software\Classes\auctionarena"
  ${endIf}
!macroend
