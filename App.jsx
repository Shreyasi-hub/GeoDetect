import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ---------------- LEAFLET ICON FIX ---------------- */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

/* ---------------- BLINKING CSS ---------------- */
const styleSheet = document.createElement("style");
styleSheet.innerHTML = `
@keyframes blinkRed {
  0% { background-color: #ff0000; }
  50% { background-color: #8b0000; }
  100% { background-color: #ff0000; }
}

.blink {
  animation: blinkRed 0.8s infinite;
}
`;
document.head.appendChild(styleSheet);

/* ---------------- APP ---------------- */
function App() {
  const [deviceId] = useState(() =>
    "DEV-" + Math.floor(Math.random() * 1000)
  );
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null); // FIXED: Properly used below
  const [speed, setSpeed] = useState(0);
  const [status, setStatus] = useState("SAFE");
  const [serverIP, setServerIP] = useState("192.168.33.201");
  const [isActive, setIsActive] = useState(false);

  const mapDiv = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  /* ---------------- MAP INIT ---------------- */
  useEffect(() => {
    if (!map.current && mapDiv.current) {
      map.current = L.map(mapDiv.current).setView([20.5937, 78.9629], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap",
      }).addTo(map.current);
    }
  }, []);

  /* ---------------- GPS TRACKING ---------------- */
  useEffect(() => {
    let watchId = null;

    if (isActive) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, speed: s } = pos.coords;
          const currentSpeed = s ? (s * 3.6).toFixed(1) : 0;

          setLat(latitude);
          setLng(longitude);
          setSpeed(currentSpeed);

          if (map.current) {
            map.current.setView([latitude, longitude], 16);
            if (marker.current) {
              marker.current.setLatLng([latitude, longitude]);
            } else {
              marker.current = L.marker([latitude, longitude]).addTo(
                map.current
              );
            }
          }

          fetch(`http://${serverIP}:5000/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: deviceId,
              lat: latitude,
              lng: longitude,
              speed: currentSpeed,
              vehicle_type: "CAR",
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              setStatus(data.status);
            })
            .catch(() =>
              console.error("Server connection failed. Check IP and Flask.")
            );
        },
        (err) => console.error("GPS Error:", err),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isActive, serverIP, deviceId]);

  /* ---------------- MOBILE VIBRATION ---------------- */
  useEffect(() => {
    let interval;

    if (status === "RISK" && navigator.vibrate) {
      interval = setInterval(() => {
        navigator.vibrate([400, 200, 400]);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, [status]);

  /* ---------------- UI ---------------- */
  return (
    <div
      style={styles.container}
      className={status === "RISK" ? "blink" : ""}
    >
      {/* HEADER */}
      <div
        style={{
          ...styles.header,
          backgroundColor: status === "RISK" ? "#e74c3c" : "#2c3e50",
        }}
      >
        <h2>
          {status === "RISK"
            ? "⚠️ COLLISION ALERT"
            : "🚗 GeoDetect"}
        </h2>
        <p style={styles.small}>
          ID: {deviceId} | Status: {status}
        </p>
      </div>

      {/* SERVER INPUT */}
      <div style={styles.serverBar}>
        <label style={{ fontSize: "12px" }}>Server IPv4:</label>
        <input
          type="text"
          value={serverIP}
          onChange={(e) => setServerIP(e.target.value)}
          placeholder="192.168.33.201"
          style={styles.input}
        />
      </div>

      {/* MAP */}
      <div ref={mapDiv} style={styles.map}></div>

      {/* STATUS BAR (lng FIX ADDED HERE) */}
      <div style={styles.status}>
        <div>
          📍 {lat ? lat.toFixed(4) : "--"} ,{" "}
          {lng ? lng.toFixed(4) : "--"}
        </div>
        <div>⚡ {speed} km/h</div>
      </div>

      {/* BUTTON */}
      <div style={styles.btnDiv}>
        <button
          onClick={() => setIsActive(!isActive)}
          style={isActive ? styles.stop : styles.start}
        >
          {isActive ? "STOP MONITORING" : "START MONITORING"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */
const styles = {
  container: {
    fontFamily: "Arial",
    minHeight: "100vh",
    background: "#f5f5f5",
    transition: "0.3s",
  },
  header: {
    color: "white",
    padding: "15px",
    textAlign: "center",
    transition: "0.3s",
  },
  small: { fontSize: "12px", opacity: 0.8, margin: "5px 0 0" },
  serverBar: {
    padding: "10px",
    background: "white",
    borderBottom: "1px solid #ddd",
  },
  input: {
    width: "100%",
    padding: "8px",
    marginTop: "5px",
    borderRadius: "5px",
    border: "1px solid #ccc",
  },
  map: { width: "100%", height: "45vh" },
  status: {
    display: "flex",
    justifyContent: "space-around",
    padding: "15px",
    background: "#3498db",
    color: "white",
  },
  btnDiv: { padding: "20px" },
  start: {
    width: "100%",
    padding: "15px",
    background: "#2ecc71",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
  },
  stop: {
    width: "100%",
    padding: "15px",
    background: "#7f8c8d",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
  },
};

export default App;