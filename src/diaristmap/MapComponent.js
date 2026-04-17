import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const getAddressLatitude = (address = {}) => address?.latitude ?? address?.Latitude;
const getAddressLongitude = (address = {}) => address?.longitude ?? address?.Longitude;
const getDiaristCoordinates = (diarista = {}) => diarista.coordinates || diarista.coordenadas || {};
const getDiaristProfile = (diarista = {}) => diarista.diarist_profile || diarista.diaristas?.[0] || {};

// Componente que atualiza a posição do mapa ao mudar o endereço selecionado
function MapUpdater({ selectedAddress }) {
  const map = useMap();

  useEffect(() => {
    if (selectedAddress) {
      map.setView([getAddressLatitude(selectedAddress), getAddressLongitude(selectedAddress)], map.getZoom(), { animate: true });
    }
  }, [selectedAddress, map]);

  return null;
}

export default function MapComponent({ selectedAddress, diaristas }) {
  const renderRatingStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => {
      const fillPercent = Math.min(Math.max(rating - i, 0), 1) * 100;
      const starStyle = {
        fontSize: 18,
        textShadow: "0 0 1px #fff, 0 0 1px #fff",
      };

      return (
        <span
          key={i}
          style={{
            display: "inline-block",
            position: "relative",
            width: 18,
            height: 18,
            marginRight: 2,
            fontSize: 18,
          }}
        >
          <span style={{ ...starStyle, color: "#888" }}>?</span>
          <span
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: `${fillPercent}%`,
              overflow: "hidden",
              color: "#FFD700",
              ...starStyle,
            }}
          >
            ?
          </span>
        </span>
      );
    });
  };

  const createCustomIcon = (photo) => {
    return L.divIcon({
      html: `
        <div class="marker-pin-wrapper">
          <div class="marker-pin">
            <img src="${photo}" alt="Diarista" class="marker-pin-photo" />
          </div>
          <div class="marker-pin-tip"></div>
        </div>`,
      className: "custom-div-icon",
      iconSize: [45, 55],
      iconAnchor: [22.5, 55],
      popupAnchor: [0, -50],
    });
  };

  const userIcon = new L.Icon({
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    shadowSize: [41, 41],
    className: "green-marker",
  });

  return (
    <MapContainer
      center={[getAddressLatitude(selectedAddress), getAddressLongitude(selectedAddress)]}
      zoom={12}
      className="map-container"
    >
      <MapUpdater selectedAddress={selectedAddress} /> {/* Atualiza a posio do mapa */}
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {diaristas.map((diarista) => {
        const coordinates = getDiaristCoordinates(diarista);
        const profile = getDiaristProfile(diarista);
        return (
        <Marker
          key={diarista.id}
          position={[coordinates.latitude, coordinates.longitude]}
          icon={createCustomIcon(diarista.photo)}
        >
	          <Popup>
	            <div className="popup-content" style={{ textAlign: 'center', minWidth: '180px' }}>
	              <img 
                  src={diarista.photo} 
                  alt={diarista.name} 
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    marginBottom: '10px',
                    border: '2px solid #3b82f6'
                  }} 
                />
	              <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{diarista.name}</h3>
	              <div style={{ marginBottom: '10px' }}>
	                {renderRatingStars(diarista.average_rating)}
	              </div>
                <div style={{ textAlign: 'left', fontSize: '13px', lineHeight: '1.4' }}>
                  <p style={{ margin: '2px 0' }}><strong>Distncia:</strong> {diarista.distance}</p>
                  <p style={{ margin: '2px 0' }}><strong>Valor/Hora:</strong> R$ {profile.price_per_hour || profile.PricePerHour || 0}</p>
              <p style={{ margin: '2px 0' }}><strong>Valor/diária:</strong> R$ {profile.price_per_day || profile.PricePerDay || 0}</p>
                  <p style={{ margin: '2px 0' }}><strong>Experincia:</strong> {profile.experience_years || profile.ExperienceYears || 0} anos</p>
                </div>
	            </div>
	          </Popup>
        </Marker>
      )})}

      <Marker position={[getAddressLatitude(selectedAddress), getAddressLongitude(selectedAddress)]} icon={userIcon}>
        <Popup>Voce est aqui</Popup>
      </Marker>
    </MapContainer>
  );
}
