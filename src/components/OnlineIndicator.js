import React from "react";
import "./onlineIndicator.css";

const OnlineIndicator = ({
  isOnline = false,
  label = "",
  className = "",
  compact = false,
}) => {
  const rootClassName = [
    "online-indicator",
    isOnline ? "is-online" : "is-offline",
    compact ? "is-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={rootClassName}>
      <span className="online-indicator-dot" aria-hidden="true" />
      {label ? <span className="online-indicator-label">{label}</span> : null}
    </span>
  );
};

export default OnlineIndicator;
