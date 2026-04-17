import React, { useState, useEffect } from "react";
import { Modal } from "antd";
import { useAddress } from "../context/address";

// Componente de Lista
import DiaristsList from "../diaristmap/DiaritstList.js";
import Order from "../order/index.js";
import "./styles.css";
import { buildApiPathUrl } from "../config/api";

export default function MapPage() {
  const { selectedAddress, Logged, setLogged, selectedDiarista } = useAddress();
  const [diaristas, setDiaristas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  useEffect(() => {
    const lat = selectedAddress?.latitude ?? selectedAddress?.Latitude;
    const lng = selectedAddress?.longitude ?? selectedAddress?.Longitude;
    if (!lat || !lng) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
    if (!token) throw new Error("Token não encontrado.");
        const url = `${buildApiPathUrl("/diarists-nearby")}?latitude=${lat}&longitude=${lng}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            setLogged(false);
            localStorage.removeItem("token");
          }
          return;
        }

        const data = await response.json();
        console.log("[limpae-front] /diarists-nearby raw payload", data);
        setDiaristas(Array.isArray(data) ? data : []);
        console.log("[limpae-front] diaristas state candidate", Array.isArray(data) ? data : []);
        if (!Logged) setLogged(true);
      } catch (error) {
        console.error("Erro na requisio:", error?.message || error);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedAddress?.latitude, selectedAddress?.longitude, selectedAddress?.Latitude, selectedAddress?.Longitude, Logged, setLogged]);

  return (
    <div className="map-page" role="main">
      <div className="container-map">
        <div className="map-content">
          {/* Lista de Diaristas - Agora como visao nica */}
          <DiaristsList
            diaristas={diaristas}
            loading={loading}
            onHireClick={() => setOrderModalVisible(true)}
            className="full-width-list"
          />

          <Modal
            open={orderModalVisible}
            footer={null}
            onCancel={() => setOrderModalVisible(false)}
            title="Contratar Diarista"
            className="order-modal-fullscreen"
            width="100%"
            centered
            destroyOnClose
          >
            {selectedDiarista && (
              <Order diarista={selectedDiarista} onClose={() => setOrderModalVisible(false)} />
            )}
          </Modal>
        </div>
      </div>
    </div>
  );
}
