// The menu bar. macOS gets the app's own menu first (About, Hide, Quit); Windows and Linux
// get a File menu instead. Edit is needed for copy and paste to work in the chat.
import { app, Menu } from 'electron';

export function buildMenu({ goTo, goBack, goForward, openInBrowser }) {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : [{ label: 'File', submenu: [{ role: 'quit' }] }]),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        // Developer tools only while working on the app, not in the installed one
        ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'toggleDevTools' }]),
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: () => goTo('/') },
        { label: 'Back', accelerator: isMac ? 'Cmd+[' : 'Alt+Left', click: goBack },
        { label: 'Forward', accelerator: isMac ? 'Cmd+]' : 'Alt+Right', click: goForward },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'How to Play', click: () => goTo('/guide') },
        { label: 'Privacy Policy', click: () => goTo('/privacy') },
        { type: 'separator' },
        { label: 'Open in Your Browser', click: openInBrowser },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
