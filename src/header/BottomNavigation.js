import React, { startTransition, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAddress } from "../context/address";
import {
  EnvironmentOutlined,
  TagOutlined,
  OrderedListOutlined,
} from "@ant-design/icons";
import "./bottom-navigation.css";

const clientMenuItems = [
  {
    key: "map",
    label: "Diaristas",
    icon: <EnvironmentOutlined />,
    path: "/map",
  },
  {
    key: "offers",
    label: "Ofertas",
    icon: <TagOutlined />,
    path: "/offers",
  },
  {
    key: "services",
    label: "Serviços",
    icon: <OrderedListOutlined />,
    path: "/services",
  },
];

const diaristMenuItems = [
  {
    key: "offers",
    label: "Ofertas",
    icon: <TagOutlined />,
    path: "/offers",
  },
  {
    key: "services",
    label: "Serviços",
    icon: <OrderedListOutlined />,
    path: "/services",
  },
];

const BottomNavigation = () => {
  const { Logged, userRole } = useAddress();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = useMemo(
    () => (userRole === "diarista" ? diaristMenuItems : clientMenuItems),
    [userRole]
  );

  const handleNavigation = (path) => {
    startTransition(() => {
      navigate(path);
    });
  };

  // Nao exibir bottom nav se nao estiver logado
  if (!Logged) {
    return null;
  }

  return (
    <nav className="bottom-navigation">
      <div className="bottom-nav-container">
        {menuItems.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            onClick={() => handleNavigation(item.path)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default React.memo(BottomNavigation);
