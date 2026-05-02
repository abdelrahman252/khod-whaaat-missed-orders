const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Window
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close:    () => ipcRenderer.send("window-close"),

  // License
  checkLicense:  () => ipcRenderer.invoke("check-license"),
  submitLicense: (key) => ipcRenderer.invoke("submit-license", key),

  // Credentials
  getCredentials:  () => ipcRenderer.invoke("get-credentials"),
  saveCredentials: (creds) => ipcRenderer.invoke("save-credentials", creds),
  clearAllData:    () => ipcRenderer.invoke("clear-all-data"),

  // Settings
  setAutoRun:         (val)  => ipcRenderer.invoke("set-auto-run", val),
  setAutoRunInterval: (mins) => ipcRenderer.invoke("set-auto-run-interval", mins),
  setLaunchMinimized: (val)  => ipcRenderer.invoke("set-launch-minimized", val),
  killBot:            ()     => ipcRenderer.send("kill-bot"),
  openFolder:         (folder) => ipcRenderer.invoke("open-folder", folder),

  // Bot
  runBot:          (params) => ipcRenderer.invoke("run-bot", params),
  botStarted:      () => ipcRenderer.send("bot-started"),
  botFinished:     () => ipcRenderer.send("bot-finished"),
  onBotLog:        (cb) => ipcRenderer.on("bot-log",           (_, msg)  => cb(msg)),
  on2faNeeded:     (cb) => ipcRenderer.on("bot-2fa-needed",    ()        => cb()),
  onNeedsConfirm:  (cb) => ipcRenderer.on("bot-needs-confirm", ()        => cb()),
  onPreview:       (cb) => ipcRenderer.on("bot-preview",       (_, data) => cb(data)),
  onOrderProgress: (cb) => ipcRenderer.on("bot-order-progress",(_, data) => cb(data)),
  onAutoRunTick:   (cb) => ipcRenderer.on("auto-run-tick",     (_, data) => cb(data)),
  onLicenseExpired:(cb) => ipcRenderer.on("license-expired",   ()        => cb()),
  on:              (ch, cb) => ipcRenderer.on(ch, (_, data) => cb(data)),
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch),

  // Settings (theme + lang)
  getSettings:  () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),

  // Output
  saveOutputFile: (data) => ipcRenderer.invoke("save-output-file", data),
});
