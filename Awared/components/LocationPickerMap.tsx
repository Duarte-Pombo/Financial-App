import React, { useMemo, useRef } from "react";
import { WebView } from "react-native-webview";

export type LatLng = { latitude: number; longitude: number };

type Props = {
  /** Initial map center. */
  initial: LatLng;
  /** Fired (debounced) whenever the map stops moving — center of the map. */
  onRegionChange?: (region: LatLng) => void;
  style?: object;
};

/**
 * Free, no-API-key map using OpenStreetMap raster tiles rendered with Leaflet
 * inside a WebView. Mirrors the old `react-native-maps` behaviour: the user
 * drags the map under a fixed center pin; the center coordinate is what gets
 * reverse-geocoded on confirm.
 *
 * Tile usage follows the OSM tile policy — fine for low volume / prototype.
 * For production scale, swap the tile URL for a hosted/keyed provider.
 */
export default function LocationPickerMap({ initial, onRegionChange, style }: Props) {
  const webRef = useRef<WebView>(null);

  // Build the HTML once from the initial coords; later moves come from the user.
  const html = useMemo(
    () => buildHtml(initial.latitude, initial.longitude),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <WebView
      ref={webRef}
      originWhitelist={["*"]}
      source={{ html }}
      style={style}
      // Lets the map's drag gestures win over the parent ScrollView/Modal.
      nestedScrollEnabled
      onMessage={(e) => {
        try {
          const { latitude, longitude } = JSON.parse(e.nativeEvent.data);
          onRegionChange?.({ latitude, longitude });
        } catch {
          /* ignore malformed messages */
        }
      }}
    />
  );
}

function buildHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #FAF6EF; }
    .leaflet-control-attribution { font-size: 9px; }
    /* Fixed center pin, drawn in CSS so it never moves while the map pans. */
    #pin {
      position: absolute; left: 50%; top: 50%; z-index: 1000;
      width: 28px; height: 28px; margin-left: -14px; margin-top: -28px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <svg id="pin" viewBox="0 0 24 24" fill="none">
    <path d="M12 2 C7 2 4 6 4 10 C4 16 12 22 12 22 C12 22 20 16 20 10 C20 6 17 2 12 2 Z"
          fill="#ff4444" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="12" cy="10" r="3" fill="#ffffff"/>
  </svg>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([${lat}, ${lng}], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    function postCenter() {
      var c = map.getCenter();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ latitude: c.lat, longitude: c.lng })
        );
      }
    }
    map.on('moveend', postCenter);
    // Emit the initial center so the parent has coords before any drag.
    postCenter();
  </script>
</body>
</html>`;
}
