import React, { useMemo } from "react";
import { Platform, View } from "react-native";
import { WebView } from "react-native-webview";
import Svg, { Path, Circle } from "react-native-svg";

// Native map (Apple Maps) only on iOS — works in Expo Go without an API key.
// On Android we render a keyless Leaflet/OSM WebView instead.
let MapView: any = null;
if (Platform.OS === "ios") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MapView = require("react-native-maps").default;
}

export type LatLng = { latitude: number; longitude: number };

type Props = {
  /** Coordinate to preview, drawn under a centered pin. */
  coordinate: LatLng;
  style?: object;
};

/**
 * Small, non-interactive map preview of a single coordinate. Mirrors
 * `LocationPickerMap`'s platform split (native iOS / Leaflet elsewhere) but is
 * read-only: no panning, zooming or gestures.
 */
export default function LocationPreviewMap({ coordinate, style }: Props) {
  if (Platform.OS === "ios" && MapView) {
    return (
      <View style={[{ overflow: "hidden" }, style]} pointerEvents="none">
        <MapView
          style={{ flex: 1 }}
          region={{
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: 0.006,
            longitudeDelta: 0.006,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        />
        {/* Centered pin — its tip points at the coordinate. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ transform: [{ translateY: -13 }] }}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2 C7 2 4 6 4 10 C4 16 12 22 12 22 C12 22 20 16 20 10 C20 6 17 2 12 2 Z"
                fill="#ff4444"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <Circle cx={12} cy={10} r={3} fill="#ffffff" />
            </Svg>
          </View>
        </View>
      </View>
    );
  }

  return <LeafletPreview coordinate={coordinate} style={style} />;
}

function LeafletPreview({ coordinate, style }: Props) {
  const html = useMemo(
    () => buildPreviewHtml(coordinate.latitude, coordinate.longitude),
    [coordinate.latitude, coordinate.longitude]
  );

  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html }}
      style={style}
      scrollEnabled={false}
      // Read-only preview: swallow touches so it never scrolls/zooms.
      pointerEvents="none"
    />
  );
}

function buildPreviewHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #FAF6EF; }
    .leaflet-control-attribution { font-size: 8px; }
    #pin {
      position: absolute; left: 50%; top: 50%; z-index: 1000;
      width: 26px; height: 26px; margin-left: -13px; margin-top: -26px;
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
    // Fully non-interactive preview map.
    var map = L.map('map', {
      zoomControl: false, attributionControl: true,
      dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false
    }).setView([${lat}, ${lng}], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  </script>
</body>
</html>`;
}
