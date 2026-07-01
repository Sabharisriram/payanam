import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { C } from '../theme/colors';

const STOP_ICONS = {
  tea: '☕', breakfast: '🍳', lunch: '🍽️', dinner: '🌙',
  snack: '🥤', sightseeing: '📸', viewpoint: '🏔️',
  fuel: '⛽', stay: '🏨', accommodation: '🏨', activity: '🎯', meal: '🍽️',
};

function buildMapHtml(stops) {
  const stopsData = stops.map(s => ({
    lat: s.stop_lat ?? null,
    lng: s.stop_lng ?? null,
    stop_type: s.stop_type || '',
    suggested_time: s.suggested_time ? s.suggested_time.slice(0, 5) : '',
    notes: s.notes || '',
  }));

  const iconsJson = JSON.stringify(STOP_ICONS);
  const stopsJson = JSON.stringify(stopsData);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#F7F8FC}
    #map{width:100vw;height:100vh}
    #loading{position:fixed;top:0;left:0;right:0;bottom:0;background:#F7F8FC;display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;gap:12px}
    #loading p{color:#6B7699;font-family:sans-serif;font-size:14px}
    #spinner{width:32px;height:32px;border:3px solid #DDE3F0;border-top-color:#2D5BE3;border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .pin{background:#2D5BE3;color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);cursor:pointer}
    .leaflet-popup-content-wrapper{border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.2)}
    .leaflet-popup-content{margin:12px 14px}
    .pp{font-family:-apple-system,sans-serif;min-width:170px;max-width:220px}
    .pp-head{font-weight:700;font-size:14px;margin-bottom:5px;color:#1A1F3A}
    .pp-place{font-size:12px;color:#6B7699;margin-bottom:4px;line-height:1.5}
    .pp-time{font-size:12px;color:#E85D3A;font-weight:600;margin-bottom:10px}
    .pp-btn{background:#4285f4;color:#fff;border:none;padding:7px 0;border-radius:7px;font-size:12px;cursor:pointer;width:100%;font-weight:600}
    .pp-btn:active{opacity:.85}
  </style>
</head>
<body>
<div id="loading"><div id="spinner"></div><p>Loading map…</p></div>
<div id="map"></div>
<script>
const ICONS=${iconsJson};
const stops=${stopsJson};

window.addEventListener('load', function() {
  document.getElementById('loading').style.display = 'none';

  const map = L.map('map', {zoomControl: true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '\\u00a9 OpenStreetMap contributors'
  }).addTo(map);

  const pts = [];

  stops.forEach(function(s, i) {
    if (!s.lat || !s.lng) return;

    const num = pts.length + 1;
    const icon = L.divIcon({
      html: '<div class="pin">' + num + '</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -20],
      className: ''
    });

    const placeName = s.notes ? s.notes.split('|')[0].trim() : s.stop_type;
    const stopIco = ICONS[s.stop_type] || '\\ud83d\\udccd';
    const stopLabel = s.stop_type.charAt(0).toUpperCase() + s.stop_type.slice(1);

    const popup =
      '<div class="pp">' +
      '<div class="pp-head">' + stopIco + '\\u00a0' + stopLabel + '</div>' +
      '<div class="pp-place">' + placeName + '</div>' +
      '<div class="pp-time">\\u23f0 ' + s.suggested_time + '</div>' +
      '<button class="pp-btn" onclick="navHere(' + s.lat + ',' + s.lng + ')">\\ud83d\\uddfa\\ufe0f Navigate Here</button>' +
      '</div>';

    L.marker([s.lat, s.lng], {icon: icon}).addTo(map).bindPopup(popup);
    pts.push([s.lat, s.lng]);
  });

  if (pts.length > 0) {
    map.fitBounds(pts, {padding: [50, 50]});
  } else {
    // Default centre: Tamil Nadu
    map.setView([11.1271, 78.6569], 7);
  }

  // Draw route via OSRM free API
  if (pts.length >= 2) {
    const waypoints = stops
      .filter(function(s) { return s.lat && s.lng; })
      .map(function(s) { return s.lng + ',' + s.lat; })
      .join(';');

    fetch('https://router.project-osrm.org/route/v1/driving/' + waypoints + '?overview=full&geometries=geojson')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.routes && data.routes[0]) {
          L.geoJSON(data.routes[0].geometry, {
            style: {color: '#2D5BE3', weight: 4, opacity: 0.85}
          }).addTo(map);
        }
      })
      .catch(function() {
        // Route unavailable — markers still show
      });
  }
});

function navHere(lat, lng) {
  window.ReactNativeWebView.postMessage(
    JSON.stringify({type: 'navigate', lat: lat, lng: lng})
  );
}
<\/script>
</body>
</html>`;
}

export default function MapScreen({ route, navigation }) {
  const { stops = [], tripName = 'Trip Map' } = route.params;

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'navigate') {
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`
        );
      }
    } catch (_) {}
  }, []);

  const openFullRoute = useCallback(() => {
    const valid = stops.filter(s => s.stop_lat && s.stop_lng);
    if (valid.length === 0) return;

    const first = valid[0];
    const last = valid[valid.length - 1];
    const origin = `${first.stop_lat},${first.stop_lng}`;
    const destination = `${last.stop_lat},${last.stop_lng}`;

    let url;
    if (valid.length <= 2) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    } else {
      const waypoints = valid
        .slice(1, -1)
        .map(s => `${s.stop_lat},${s.stop_lng}`)
        .join('|');
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}`;
    }
    Linking.openURL(url);
  }, [stops]);

  const [webViewError, setWebViewError] = useState(false);

  const mapHtml = buildMapHtml(stops);
  const hasCoords = stops.some(s => s.stop_lat && s.stop_lng);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{tripName}</Text>
      </View>

      {hasCoords && !webViewError ? (
        <WebView
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled
          originWhitelist={['*']}
          onMessage={handleMessage}
          onError={() => setWebViewError(true)}
          onHttpError={() => setWebViewError(true)}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={C.PRIMARY} size="large" />
            </View>
          )}
        />
      ) : webViewError ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>Map requires internet connection</Text>
          <Text style={styles.emptyDesc}>
            Connect to the internet and tap the button below to open the route in Google Maps instead.
          </Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🗺️</Text>
          <Text style={styles.emptyTitle}>No map data yet</Text>
          <Text style={styles.emptyDesc}>
            Coordinates are saved when you generate a trip plan.
            Regenerate the plan to enable the map.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.mapsBtn, !hasCoords && styles.mapsBtnDisabled]}
        onPress={openFullRoute}
        disabled={!hasCoords}
      >
        <Text style={styles.mapsBtnText}>🗺️  Open Full Route in Google Maps</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.BORDER,
    gap: 12,
  },
  back: { color: C.PRIMARY, fontSize: 16 },
  title: { flex: 1, color: C.INK, fontSize: 16, fontWeight: 'bold' },
  map: { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.BG,
  },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: C.INK, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptyDesc: { color: C.INK_MUTED, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  mapsBtn: {
    backgroundColor: C.CARD_ALT,
    margin: 12,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.PRIMARY,
  },
  mapsBtnDisabled: { opacity: 0.4 },
  mapsBtnText: { color: C.INK, fontSize: 14, fontWeight: 'bold' },
});
