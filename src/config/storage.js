const memoryStorage = new Map();

const hasWindow = typeof window !== "undefined";
const canUseLocalStorage = hasWindow && typeof window.localStorage !== "undefined";
const canUseSessionStorage = hasWindow && typeof window.sessionStorage !== "undefined";

const getWebStorageValue = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch (_error) {
    return null;
  }
};

const setWebStorageValue = (storage, key, value) => {
  try {
    storage.setItem(key, value);
  } catch (_error) {
  }
};

const removeWebStorageValue = (storage, key) => {
  try {
    storage.removeItem(key);
  } catch (_error) {
  }
};

export const getPersistentItem = (key) => {
  if (canUseLocalStorage) {
    return getWebStorageValue(window.localStorage, key);
  }

  return memoryStorage.get(`persistent:${key}`) ?? null;
};

export const setPersistentItem = async (key, value) => {
  if (canUseLocalStorage) {
    setWebStorageValue(window.localStorage, key, value);
    return;
  }

  memoryStorage.set(`persistent:${key}`, value);
};

export const removePersistentItem = async (key) => {
  if (canUseLocalStorage) {
    removeWebStorageValue(window.localStorage, key);
    return;
  }

  memoryStorage.delete(`persistent:${key}`);
};

export const getSessionItem = (key) => {
  if (canUseSessionStorage) {
    return getWebStorageValue(window.sessionStorage, key);
  }

  return memoryStorage.get(`session:${key}`) ?? null;
};

export const setSessionItem = (key, value) => {
  if (canUseSessionStorage) {
    setWebStorageValue(window.sessionStorage, key, value);
    return;
  }

  memoryStorage.set(`session:${key}`, value);
};

export const removeSessionItem = (key) => {
  if (canUseSessionStorage) {
    removeWebStorageValue(window.sessionStorage, key);
    return;
  }

  memoryStorage.delete(`session:${key}`);
};
