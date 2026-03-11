import { Menu, Tray, nativeImage, type BrowserWindow } from "electron";

import { APP_NAME } from "./branding.js";

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#081018" />
      <path d="M18 18h18c9.94 0 18 8.06 18 18S45.94 54 36 54H22V44h14c4.42 0 8-3.58 8-8s-3.58-8-8-8H18V18z" fill="#4de2ff" />
      <circle cx="46" cy="18" r="5" fill="#ffc24b" />
    </svg>
  `.trim();

  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`)
    .resize({ width: 18, height: 18 });
}

export function createAppTray(window: BrowserWindow, quit: () => void) {
  const tray = new Tray(createTrayIcon());
  const showWindow = () => {
    if (window.isMinimized()) {
      window.restore();
    }
    window.show();
    window.focus();
  };

  tray.setToolTip(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: `Open ${APP_NAME}`,
        click: showWindow
      },
      {
        label: "Hide Window",
        click: () => {
          window.hide();
        }
      },
      {
        type: "separator"
      },
      {
        label: `Quit ${APP_NAME}`,
        click: quit
      }
    ])
  );

  tray.on("click", showWindow);
  return tray;
}
