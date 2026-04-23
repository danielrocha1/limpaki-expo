import { Platform } from "react-native";

const MapConfirmModal =
  Platform.OS === "web"
    ? require("./MapConfirmModal.web.js").default
    : require("./MapConfirmModal.native.js").default;

export default MapConfirmModal;
