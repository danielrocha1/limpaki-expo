import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Dropdown, Space } from "antd";
import {
  DownOutlined,
  MessageOutlined,
  UserOutlined,
  PlusOutlined,
  IdcardOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  TagOutlined,
  OrderedListOutlined,
  CreditCardOutlined,
} from "@ant-design/icons";

import { useAddress } from "../context/address";
import { useChatCenter } from "../context/chatCenter";
import { useOnlinePresence } from "../context/onlinePresence";
import OnlineIndicator from "../components/OnlineIndicator";
import { clearToken } from "../config/api";
import "./header.css";
import "antd/dist/reset.css";

const getUserPhoto = (user = {}) => (
  user?.Photo ||
  user?.photo ||
  user?.profile_photo ||
  user?.profilePhoto ||
  user?.profile_picture ||
  user?.profilePicture ||
  user?.image ||
  user?.Image ||
  user?.image_url ||
  user?.imageUrl ||
  user?.Avatar ||
  user?.avatar ||
  ""
);

const getInitials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

const getChatCounterpartName = (service, userRole) => {
  if (userRole === "cliente") {
    return (
      service?.diarist?.name ||
      service?.diarist?.Name ||
      service?.diarist_name ||
      service?.diaristName ||
      "Diarista"
    );
  }

  return (
    service?.client?.name ||
    service?.client?.Name ||
    service?.client_name ||
    service?.clientName ||
    "Cliente"
  );
};

const formatChatScheduledDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
};

const menuActionLabel = (label, onNavigate) => (
  <button
    type="button"
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onNavigate();
    }}
    style={{
      display: "block",
      width: "100%",
      textAlign: "left",
      color: "inherit",
      background: "transparent",
      border: "none",
      padding: 0,
    }}
  >
    {label}
  </button>
);

const menuActionMenuItem = (label, onNavigate, icon = null) => (
  <button
    type="button"
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onNavigate();
    }}
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      width: "100%",
      color: "inherit",
      background: "transparent",
      border: "none",
      padding: 0,
    }}
  >
    {icon}
    <span className="ant-dropdown-menu-title-content">{label}</span>
  </button>
);

const Header = () => {
  const navigate = useNavigate();
  const [isAddressMenuOpen, setIsAddressMenuOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );
  const addressMenuRef = useRef(null);
  const chatMenuRef = useRef(null);

  const {
    address,
    selectedAddress,
    setSelectedAddress,
    Logged,
    setLogged,
    userRole,
    hasValidSubscription,
    sessionLoading,
    addressLoading,
  } = useAddress();
  const { chatSummaries, openChat, totalUnreadCount } = useChatCenter();
  const { isClientOnline, isDiaristOnline } = useOnlinePresence();

  const navigateFromMenu = useCallback((path, options) => {
    setIsUserMenuOpen(false);
    setIsAddressMenuOpen(false);
    setIsChatMenuOpen(false);
    navigate(path, options);
  }, [navigate]);

  const logout = useCallback(() => {
    clearToken();
    setLogged(false);
    navigate("/");
  }, [navigate, setLogged]);

  useEffect(() => {
    if (!isAddressMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (
        addressMenuRef.current &&
        !addressMenuRef.current.contains(event.target)
      ) {
        setIsAddressMenuOpen(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setIsAddressMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isAddressMenuOpen]);

  useEffect(() => {
    if (!isChatMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target)) {
        setIsChatMenuOpen(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setIsChatMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isChatMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const handleViewportChange = (event) => {
      setIsMobileView(event.matches);
    };

    setIsMobileView(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleViewportChange);

      return () => {
        mediaQuery.removeEventListener("change", handleViewportChange);
      };
    }

    mediaQuery.addListener(handleViewportChange);

    return () => {
      mediaQuery.removeListener(handleViewportChange);
    };
  }, []);

  const handleSelectAddress = (addr) => {
    setSelectedAddress(addr);
    setIsAddressMenuOpen(false);
  };

  const handleUserMenuClick = ({ key }) => {
    switch (key) {
      case "logout":
        logout();
        setIsUserMenuOpen(false);
        break;
      default:
        break;
    }
  };

  const primaryDesktopMenuItems = useMemo(
    () => [
      {
        key: "offers",
        icon: <TagOutlined />,
        label: menuActionLabel("Ofertas", () => {
          navigateFromMenu("/offers");
        }),
      },
      {
        key: "services",
        icon: <OrderedListOutlined />,
        label: menuActionLabel("Servi\u00e7os", () => {
          navigateFromMenu("/services");
        }),
      },
      ...(userRole !== "diarista"
        ? [
            {
              key: "map",
              icon: <EnvironmentOutlined />,
              label: menuActionLabel("Diaristas", () => {
                navigateFromMenu("/map");
              }),
            },
          ]
        : []),
    ],
    [navigateFromMenu, userRole]
  );

  const userMenuItems = useMemo(
    () => [
      ...(!isMobileView
        ? [
            ...primaryDesktopMenuItems,
            {
              type: "divider",
            },
          ]
        : []),
      {
        key: "profile",
        icon: <IdcardOutlined />,
        label: menuActionLabel("Meu Perfil", () => {
          navigateFromMenu("/profile");
        }),
      },
      ...(!sessionLoading && !hasValidSubscription
        ? [
            {
              key: "subscription",
              icon: <CreditCardOutlined />,
              label: menuActionLabel("Assinatura", () => {
                navigateFromMenu("/assinatura/planos");
              }),
            },
          ]
        : []),
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "Sair",
      },
    ],
    [hasValidSubscription, isMobileView, navigateFromMenu, primaryDesktopMenuItems, sessionLoading]
  );

  return (
    <header className="header">
      <div className="logo">
          <Link to="/" aria-label="Ir para a p\u00e1gina inicial">
          <img
            src="/limpae-logo.png"
            alt="Limpae Logo"
            style={{ height: "40px", width: "auto", display: "block" }}
          />
        </Link>
      </div>

      {Logged ? (
        <div className="header-center-slot">
          <div className="address-container" ref={addressMenuRef}>
            <button
              type="button"
              className="address-button"
              onClick={() => {
                if (addressLoading) {
                  return;
                }
                setIsAddressMenuOpen((prevOpen) => {
                  const nextOpen = !prevOpen;
                  if (nextOpen) {
                    setIsUserMenuOpen(false);
                  }
                  return nextOpen;
                });
              }}
              style={{
                background: "none",
                border: "none",
                cursor: addressLoading ? "default" : "pointer",
                color: "white",
              }}
              aria-busy={addressLoading}
            >
              <Space>
                {addressLoading ? (
                  <span className="address-loading-inline">
                    <span className="address-loading-spinner" aria-hidden="true" />
                    <span className="address-text1">Carregando...</span>
                  </span>
                ) : (
                  <>
                    <span className="address-text1">
                      {selectedAddress
                        ? selectedAddress.street || selectedAddress.Street
                : "Selecione um endere\u00e7o"}
                    </span>
                    <DownOutlined />
                  </>
                )}
              </Space>
            </button>

            {isAddressMenuOpen && (
              <div
                className="header-dropdown-overlay header-address-overlay"
                role="presentation"
              >
                <ul
                  className="ant-dropdown-menu ant-dropdown-menu-root ant-dropdown-menu-vertical"
                  role="menu"
                >
                  {address?.length ? (
                    address.map((addr, index) => (
                      <li
                        key={`addr-${index}`}
                        className="ant-dropdown-menu-item"
                        role="menuitem"
                        tabIndex={0}
                        onClick={() => handleSelectAddress(addr)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectAddress(addr);
                          }
                        }}
                      >
                        <EnvironmentOutlined />
                        <span className="ant-dropdown-menu-title-content">
                          {addr.street || addr.Street}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li
                      className="ant-dropdown-menu-item ant-dropdown-menu-item-disabled"
                      role="menuitem"
                      aria-disabled="true"
                    >
                      <span className="ant-dropdown-menu-title-content">
                  Nenhum endere\u00e7o dispon\u00edvel
                      </span>
                    </li>
                  )}

                  {userRole !== "diarista" && (
                    <>
                      <li className="ant-dropdown-menu-item-divider" role="separator" />
                      <li
                        className="ant-dropdown-menu-item"
                        role="menuitem"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateFromMenu("/addressform");
                          }
                        }}
                      >
                        {menuActionMenuItem(
                  "Adicionar novo endere\u00e7o",
                          () => {
                            navigateFromMenu("/addressform");
                          },
                          <PlusOutlined />
                        )}
                      </li>
                    </>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="login-text">
          Fa\u00e7a <Link className="login-link" to="/login">Login</Link> ou{" "}
          <Link className="register-link" to="/register">Registre-se</Link>
        </div>
      )}

      {Logged && (
        <div className="header-right-actions">
          {!isMobileView && (
          <div className="header-chat-center" ref={chatMenuRef}>
            <button
              type="button"
              className="header-chat-trigger"
              onClick={() => {
                setIsChatMenuOpen((prevOpen) => !prevOpen);
                setIsUserMenuOpen(false);
                setIsAddressMenuOpen(false);
              }}
            >
              <MessageOutlined />
              <span>Chat</span>
              {totalUnreadCount > 0 && (
                <span className="header-chat-badge">{totalUnreadCount}</span>
              )}
            </button>

            {isChatMenuOpen && (
              <div className="header-chat-menu">
                  <div className="header-chat-menu-title">{"Chats dos seus servi\u00e7os"}</div>

                {chatSummaries.length === 0 ? (
                  <div className="header-chat-empty">
                    {"Nenhum chat dispon\u00edvel no momento."}
                  </div>
                ) : (
                  chatSummaries.map((summary) => {
                    const service = summary.service;
                    const counterpartId =
                      userRole === "cliente"
                        ? service?.diarist_id
                        : service?.client_id || service?.ClientID;
                    const counterpart = getChatCounterpartName(service, userRole);
                    const counterpartPhoto = getUserPhoto(
                      userRole === "cliente" ? service?.diarist : service?.client,
                    );
                    const counterpartInitials = getInitials(counterpart);
                    const scheduledLabel = formatChatScheduledDate(
                      service?.scheduled_at || service?.ScheduledAt,
                    );
                    const counterpartOnline =
                      userRole === "cliente"
                        ? isDiaristOnline(counterpartId)
                        : isClientOnline(counterpartId);
                    const counterpartStatusLabel =
                      userRole === "cliente"
                        ? (counterpartOnline ? "Diarista online" : "Diarista offline")
                        : (counterpartOnline ? "Cliente online" : "Cliente offline");

                    return (
                      <button
                        key={service?.ID}
                        type="button"
                        className="header-chat-menu-item"
                        onClick={(event) => {
                          event.currentTarget.blur();
                          setIsChatMenuOpen(false);

                          window.requestAnimationFrame(() => {
                            openChat(service);
                          });
                        }}
                      >
                        <div className="header-chat-menu-avatar" aria-hidden="true">
                          {counterpartPhoto ? (
                            <img src={counterpartPhoto} alt={counterpart} />
                          ) : (
                            <span>{counterpartInitials}</span>
                          )}
                        </div>

                        <div className="header-chat-menu-copy">
                          <span>
                            Serviço #{service?.ID ?? service?.id}
                            {scheduledLabel ? ` • ${scheduledLabel}` : ""}
                          </span>
                          <strong>{counterpart}</strong>
                          <OnlineIndicator
                            isOnline={counterpartOnline}
                            label={counterpartStatusLabel}
                            className="header-chat-online-indicator"
                          />
                        </div>

                        {summary.unreadCount > 0 && (
                          <span className="header-chat-item-badge">{summary.unreadCount}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
          )}
          <div className="user-container">
          <Dropdown
            menu={{
              items: userMenuItems,
              onClick: handleUserMenuClick,
            }}
            trigger={["click"]}
            placement="bottomRight"
            open={isUserMenuOpen}
            onOpenChange={(nextOpen) => {
              setIsUserMenuOpen(nextOpen);
              if (nextOpen) {
                setIsAddressMenuOpen(false);
              }
            }}
            overlayClassName="header-dropdown-overlay"
            getPopupContainer={(trigger) => trigger.parentElement}
          >
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <UserOutlined
                className="user-icon"
                style={{ fontSize: "22px", color: "white" }}
              />
            </button>
          </Dropdown>
          </div>
        </div>
      )}
    </header>
  );
};

export default React.memo(Header);
