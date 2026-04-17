import React from "react";
import { useAddress } from "../../context/address";
import { useChatCenter } from "../../context/chatCenter";
import { useServiceChat } from "./useServiceChat";

const ChatRealtimeWarmupItem = ({ service, userRole }) => {
  useServiceChat(service, userRole);
  return null;
};

const ChatRealtimeWarmup = () => {
  const { Logged, userRole } = useAddress();
  const { activeChatServices } = useChatCenter();

  if (!Logged || !userRole || !activeChatServices.length) {
    return null;
  }

  return (
    <>
      {activeChatServices.map((service) => {
        const serviceId = Number(service?.ID ?? service?.id ?? 0);
        if (!serviceId) {
          return null;
        }

        return (
          <ChatRealtimeWarmupItem
            key={serviceId}
            service={service}
            userRole={userRole}
          />
        );
      })}
    </>
  );
};

export default React.memo(ChatRealtimeWarmup);
