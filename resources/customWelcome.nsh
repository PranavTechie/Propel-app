!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Propel Setup"
  !define MUI_WELCOMEPAGE_TEXT "System care, simplified.$\r$\n$\r$\nInstall Propel on your Windows PC with a clean and secure setup."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; Override the Choose Installation Options page strings with Propel-branded copy.
; LangString LCID 1033 = English. These are redefined AFTER addLangs runs (via customHeader),
; so they safely overwrite the defaults without touching any installation logic.
!macro customHeader
  LangString chooseInstallationOptions 1033 "Install Propel"
  LangString whoShouldThisApplicationBeInstalledFor 1033 "Choose who can use Propel on this PC."
  LangString selectUserMode 1033 "Select an installation scope for Propel."
  LangString forAll 1033 "Anyone who uses this computer (&all users)"
  LangString onlyForMe 1033 "Only for &me"
  LangString freshInstallForCurrent 1033 "Install Propel for the current Windows user."
  LangString freshInstallForAll 1033 "Install Propel for all users of this computer. (requires admin)"
!macroend

; Global header styling (applies to all inner pages with a header)
!define MUI_HEADER_BGCOLOR "5AA63C" ; Propel Green in RRGGBB
!define MUI_HEADER_TEXTCOLOR "FFFFFF" ; White text for contrast

; Hook into the Installation Options page PRE function to inject a custom SHOW function
!macro customInstallMode
  !ifndef BUILD_UNINSTALLER
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW propelInstallModeShow
  !else
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW un.propelInstallModeShow
  !endif
!macroend

!macro propelInstallModeShow_Logic
  ; This is called right before the MultiUser InstallMode custom nsDialog is shown.
  
  ; 1. Set background of the custom page and all its controls to White
  SetCtlColors $MultiUser.InstallModePage "" 0xFFFFFF
  SetCtlColors $MultiUser.InstallModePage.Text "" 0xFFFFFF
  SetCtlColors $MultiUser.InstallModePage.AllUsers "" 0xFFFFFF
  SetCtlColors $MultiUser.InstallModePage.CurrentUser "" 0xFFFFFF
  SetCtlColors $RadioButtonLabel1 "" 0xFFFFFF
  
  ; 2. Create premium typography (Segoe UI)
  CreateFont $R0 "Segoe UI" 9 400
  CreateFont $R1 "Segoe UI" 10 700 ; bold for the main question
  
  ; 3. Apply fonts to controls
  SendMessage $MultiUser.InstallModePage.Text ${WM_SETFONT} $R1 0
  SendMessage $MultiUser.InstallModePage.AllUsers ${WM_SETFONT} $R0 0
  SendMessage $MultiUser.InstallModePage.CurrentUser ${WM_SETFONT} $R0 0
  SendMessage $RadioButtonLabel1 ${WM_SETFONT} $R0 0
  
  ; 4. Color the main question Propel Green (0x3CA65A in BGR)
  SetCtlColors $MultiUser.InstallModePage.Text 0x3CA65A 0xFFFFFF
!macroend

Function propelInstallModeShow
  !insertmacro propelInstallModeShow_Logic
FunctionEnd

Function un.propelInstallModeShow
  !insertmacro propelInstallModeShow_Logic
FunctionEnd


