/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer } from 'electron';

export type Channels = 'ipc-example';

const electronHandler = {
  config: {
    get: (key?: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),
    getAll: () => ipcRenderer.invoke('config:getAll'),
  },
  providers: {
    getKeys: () => ipcRenderer.invoke('providers:getKeys'),
    setKey: (provider: string, key: string) =>
      ipcRenderer.invoke('providers:setKey', provider, key),
    removeKey: (provider: string) =>
      ipcRenderer.invoke('providers:removeKey', provider),
  },
  conversations: {
    list: () => ipcRenderer.invoke('conversations:list'),
    get: (id: string) => ipcRenderer.invoke('conversations:get', id),
    save: (id: string, data: unknown) =>
      ipcRenderer.invoke('conversations:save', id, data),
    delete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
  },
  shell: {
    openPath: (p: string) => ipcRenderer.invoke('shell:openPath', p),
  },
  llm: {
    chat: (
      providerId: string,
      messages: { role: string; content: string }[],
      model: string
    ) =>
      ipcRenderer.invoke('llm:chat', { providerId, messages, model }),
    circuitStatus: () =>
      ipcRenderer.invoke('llm:circuit-status') as Promise<
        Record<string, { open: boolean; failures: number }>
      >,
  },
  app: {
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  collections: {
    list: () => ipcRenderer.invoke('collections:list'),
    get: (id: string) => ipcRenderer.invoke('collections:get', id),
    save: (id: string, data: unknown) => ipcRenderer.invoke('collections:save', id, data),
    delete: (id: string) => ipcRenderer.invoke('collections:delete', id),
  },
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    save: (id: string, data: unknown) => ipcRenderer.invoke('notes:save', id, data),
    delete: (id: string) => ipcRenderer.invoke('notes:delete', id),
  },
  bookmarkNotes: {
    list: () => ipcRenderer.invoke('bookmarkNotes:list'),
    get: (bookmarkId: string) => ipcRenderer.invoke('bookmarkNotes:get', bookmarkId),
    save: (bookmarkId: string, data: unknown) => ipcRenderer.invoke('bookmarkNotes:save', bookmarkId, data),
    delete: (bookmarkId: string) => ipcRenderer.invoke('bookmarkNotes:delete', bookmarkId),
  },
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;