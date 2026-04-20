import { Platform } from "react-native";

const MapConfirmModal =
  Platform.OS === "web"
    ? require("./MapConfirmModal.web").default
    : require("./MapConfirmModal.native").default;

export default MapConfirmModal;
