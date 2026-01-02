const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ai", {
  generateCurve: (prompt) =>
    ipcRenderer.invoke("ai:generate-curve", prompt),
});
