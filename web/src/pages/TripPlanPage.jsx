import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTrip, getTripStops, generatePlan } from '../api/trips';

const STOP_ICONS = {
  tea: '☕', breakfast: '🍳', lunch: '🍽️', dinner: '🌙',
  sightseeing: '📸', viewpoint: '🏔️', fuel: '⛽',
  accommodation: '🏨', stay: '🏨', activity: '🎯',
  meal: '🍽️', food: '🍽️', break: '🛑', attraction: '🎡',
  scenic_view: '🌄', snack: '🥤',
};

const CATEGORY_COLORS = {
  budget: '#166534', 'mid-range': '#1e3a5f',
  average: '#1e3a5f', luxury: '#4c1d95', free: '#334155', moderate: '#1e3a5f'
};

// Map icon set serialised into the iframe HTML
const MAP_ICONS = {
  tea: '☕', breakfast: '🍳', lunch: '🍽️', dinner: '🌙',
  snack: '🥤', sightseeing: '📸', viewpoint: '🏔️',
  fuel: '⛽', stay: '🏨', accommodation: '🏨',
  'stay/accommodation': '🏨', activity: '🎯', meal: '🍽️',
};

function buildMapHtml(stops) {
  const stopsData = stops
    .filter(s => s.stop_lat && s.stop_lng)
    .map(s => ({
      lat: s.stop_lat,
      lng: s.stop_lng,
      stop_type: s.stop_type || '',
      suggested_time: s.suggested_time ? s.suggested_time.slice(0, 5) : '',
      notes: s.notes || '',
    }));

  const stopsJson = JSON.stringify(stopsData);
  const iconsJson = JSON.stringify(MAP_ICONS);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;background:#1e293b}
    .pin{background:#f97316;color:#fff;border-radius:50%;width:28px;height:28px;
         display:flex;align-items:center;justify-content:center;
         font-weight:bold;font-size:12px;border:2px solid #fff;
         box-shadow:0 2px 6px rgba(0,0,0,.5);cursor:pointer}
    .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.2)}
    .leaflet-popup-content{margin:10px 12px}
    .pp{min-width:160px;max-width:210px;font-family:system-ui,sans-serif}
    .pp-head{font-weight:700;font-size:13px;margin-bottom:4px;color:#0f172a}
    .pp-place{font-size:11px;color:#475569;margin-bottom:3px;line-height:1.4}
    .pp-time{font-size:11px;color:#f97316;font-weight:600;margin-bottom:8px}
    .pp-btn{background:#4285f4;color:#fff;border:none;padding:6px 0;border-radius:6px;
            font-size:11px;cursor:pointer;width:100%;font-weight:600}
    .pp-btn:hover{opacity:.9}
  </style>
</head>
<body>
<div id="map"></div>
<script>
var stops=${stopsJson};
var ICONS=${iconsJson};

var map=L.map('map',{zoomControl:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:18,
  attribution:'© OpenStreetMap contributors'
}).addTo(map);

var pts=[];
stops.forEach(function(s){
  if(!s.lat||!s.lng)return;
  var num=pts.length+1;
  var icon=L.divIcon({
    html:'<div class="pin">'+num+'</div>',
    iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-18],className:''
  });
  var placeName=s.notes?s.notes.split('|')[0].trim():s.stop_type;
  var ico=ICONS[s.stop_type]||'📍';
  var label=s.stop_type.charAt(0).toUpperCase()+s.stop_type.slice(1);
  var popup=
    '<div class="pp">'+
    '<div class="pp-head">'+ico+' '+label+'</div>'+
    '<div class="pp-place">'+placeName+'</div>'+
    '<div class="pp-time">⏰ '+s.suggested_time+'</div>'+
    '<button class="pp-btn" onclick="navHere('+s.lat+','+s.lng+')">🗺️ Navigate Here<\/button>'+
    '<\/div>';
  L.marker([s.lat,s.lng],{icon:icon}).addTo(map).bindPopup(popup);
  pts.push([s.lat,s.lng]);
});

if(pts.length>0){map.fitBounds(pts,{padding:[40,40]});}
else{map.setView([11.1271,78.6569],7);}

if(pts.length>=2){
  var wps=stops
    .filter(function(s){return s.lat&&s.lng;})
    .map(function(s){return s.lng+','+s.lat;})
    .join(';');
  fetch('https://router.project-osrm.org/route/v1/driving/'+wps+'?overview=full&geometries=geojson')
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.routes&&d.routes[0]){
        L.geoJSON(d.routes[0].geometry,{style:{color:'#f97316',weight:4,opacity:0.85}}).addTo(map);
      }
    })
    .catch(function(){});
}

function navHere(lat,lng){
  window.parent.postMessage({type:'navigate',lat:lat,lng:lng},'*');
}
<\/script>
</body>
</html>`;
}

export default function TripPlanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data;
      if (data && data.type === 'navigate') {
        window.open(
          `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`,
          '_blank'
        );
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadData = async () => {
    try {
      const [tripData, stopsData] = await Promise.all([
        getTrip(id),
        getTripStops(id)
      ]);
      setTrip(tripData);
      setStops(stopsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generatePlan(id);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>Loading your trip plan...</p>
      </div>
    );
  }

  const days = Array.from(new Set(stops.map(s => s.day_number || 1))).sort((a, b) => a - b);
  const hasCoords = stops.some(s => s.stop_lat && s.stop_lng);

  return (
    <div style={styles.container}>
      <div style={styles.inner}>

        <button style={styles.back} onClick={() => navigate('/')}>← Back</button>

        {trip && (
          <div style={styles.tripHeader}>
            <h2 style={styles.tripName}>{trip.trip_name}</h2>
            <p style={styles.tripRoute}>{trip.start_location} → {trip.end_location}</p>
            <p style={styles.tripMeta}>
              {trip.trip_type} · {trip.vehicle_type} · {trip.member_count} members · {trip.trip_days || 1} day(s)
            </p>
          </div>
        )}

        <div style={styles.planRow}>
          <p style={styles.sectionTitle}>Your Trip Plan ({stops.length} stops)</p>
          {hasCoords && stops.length > 0 && (
            <button
              style={showMap ? styles.mapBtnActive : styles.mapBtn}
              onClick={() => setShowMap(v => !v)}
            >
              {showMap ? '✕ Hide Map' : '🗺️ View Map'}
            </button>
          )}
        </div>

        {stops.length === 0 && (
          <div style={styles.emptyPlan}>
            <p style={styles.emptyText}>No plan generated yet.</p>
            <button
              style={styles.generateBtn}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? '✨ Generating... (~20 seconds)' : 'Generate Plan ✨'}
            </button>
          </div>
        )}

        {days.map(day => (
          <div key={day}>
            <div style={styles.dayHeader}>
              <span style={styles.dayTitle}>📅 Day {day}</span>
            </div>
            {stops
              .filter(s => (s.day_number || 1) === day)
              .map((stop, index) => {
                const icon = STOP_ICONS[stop.stop_type?.toLowerCase()] || '📍';
                const notes = stop.notes?.split('|') || [];
                const location = notes[0]?.trim();
                const description = notes[1]?.trim();
                const category = stop.notes?.includes('Category:')
                  ? stop.notes.split('Category:')[1]?.trim()
                  : 'budget';

                return (
                  <div key={stop.id || index} style={styles.stopCard}>
                    <div style={styles.stopHeader}>
                      <div style={styles.timeBox}>
                        <span style={styles.icon}>{icon}</span>
                        <span style={styles.time}>{stop.suggested_time?.slice(0, 5)}</span>
                      </div>
                      <div style={styles.stopInfo}>
                        <p style={styles.stopType}>
                          {stop.stop_type?.charAt(0).toUpperCase() + stop.stop_type?.slice(1)}
                        </p>
                        <p style={styles.stopLocation}>{location}</p>
                      </div>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: CATEGORY_COLORS[category] || '#334155'
                      }}>
                        {category}
                      </span>
                    </div>
                    {description && (
                      <p style={styles.description}>{description}</p>
                    )}
                  </div>
                );
              })}
          </div>
        ))}

        {showMap && hasCoords && (
          <div style={styles.mapContainer}>
            <iframe
              srcDoc={buildMapHtml(stops)}
              style={styles.mapFrame}
              sandbox="allow-scripts allow-popups"
              title="Trip Map"
            />
          </div>
        )}

      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0f172a' },
  inner: { maxWidth: 700, margin: '0 auto', padding: '20px 16px 60px' },
  loadingContainer: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center'
  },
  loadingText: { color: '#fff', fontSize: 18 },
  back: {
    backgroundColor: 'transparent', border: 'none',
    color: '#f97316', fontSize: 16, marginBottom: 16, cursor: 'pointer', padding: 0,
  },
  tripHeader: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 16, marginBottom: 20
  },
  tripName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  tripRoute: { color: '#f97316', fontSize: 15, marginBottom: 4 },
  tripMeta: { color: '#94a3b8', fontSize: 13 },
  planRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  sectionTitle: { color: '#94a3b8', fontSize: 13, margin: 0 },
  mapBtn: {
    backgroundColor: '#1e3a5f', color: '#fff',
    padding: '6px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 'bold',
    border: '1px solid #f97316', cursor: 'pointer',
  },
  mapBtnActive: {
    backgroundColor: '#1e293b', color: '#64748b',
    padding: '6px 14px', borderRadius: 8,
    fontSize: 13, fontWeight: 'bold',
    border: '1px solid #334155', cursor: 'pointer',
  },
  emptyPlan: { textAlign: 'center', marginTop: 60 },
  emptyText: { color: '#94a3b8', marginBottom: 16 },
  generateBtn: {
    backgroundColor: '#f97316', color: '#fff',
    padding: '12px 24px', borderRadius: 10,
    fontSize: 15, fontWeight: 'bold', border: 'none', cursor: 'pointer',
  },
  dayHeader: {
    backgroundColor: '#1e3a5f', borderRadius: 8,
    padding: '10px 14px', marginBottom: 8, marginTop: 16
  },
  dayTitle: { color: '#f97316', fontSize: 15, fontWeight: 'bold' },
  stopCard: {
    backgroundColor: '#1e293b', borderRadius: 12,
    padding: 14, marginBottom: 12,
    borderLeft: '3px solid #f97316'
  },
  stopHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  timeBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 },
  icon: { fontSize: 20 },
  time: { color: '#f97316', fontSize: 12, fontWeight: 'bold', marginTop: 2 },
  stopInfo: { flex: 1 },
  stopType: { color: '#fff', fontSize: 15, fontWeight: 'bold', margin: 0 },
  stopLocation: { color: '#94a3b8', fontSize: 12, marginTop: 2, margin: 0 },
  badge: {
    padding: '3px 10px', borderRadius: 20,
    color: '#fff', fontSize: 11, whiteSpace: 'nowrap'
  },
  description: { color: '#cbd5e1', fontSize: 13, lineHeight: 1.6, margin: 0 },
  mapContainer: {
    marginTop: 28, borderRadius: 12, overflow: 'hidden',
    border: '1px solid #334155', height: 500,
  },
  mapFrame: { width: '100%', height: '100%', border: 'none', display: 'block' },
};