const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kaldi", {
  version: "0.1.0",
  selectDataDir: () => ipcRenderer.invoke("kaldi:selectDataDir"),
  getDataDir: () => ipcRenderer.invoke("kaldi:getDataDir"),
  importInbox: () => ipcRenderer.invoke("kaldi:importInbox"),
  materialize: () => ipcRenderer.invoke("kaldi:materialize"),
  loadTransactions: () => ipcRenderer.invoke("kaldi:loadTransactions")
});
