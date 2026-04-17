import AsyncStorage from "@react-native-async-storage/async-storage";

const memoryStorage = new Map();

export const getPersistentItem = (key) => memoryStorage.get(`persistent:${key}`) ?? null;

export const setPersistentItem = async (key, value) => {
  memoryStorage.set(`persistent:${key}`, value);
  await AsyncStorage.setItem(key, value);
};

export const removePersistentItem = async (key) => {
  memoryStorage.delete(`persistent:${key}`);
  await AsyncStorage.removeItem(key);
};

export const getSessionItem = (key) => memoryStorage.get(`session:${key}`) ?? null;

export const setSessionItem = (key, value) => {
  memoryStorage.set(`session:${key}`, value);
};

export const removeSessionItem = (key) => {
  memoryStorage.delete(`session:${key}`);
};
