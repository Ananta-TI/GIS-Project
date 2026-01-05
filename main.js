import './style.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { OSM, XYZ } from 'ol/source';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON.js';
import { fromLonLat } from 'ol/proj';
import { Icon, Style, Stroke, Fill } from 'ol/style.js';
import Overlay from 'ol/Overlay.js';

/* --- 1. SETUP BASEMAPS --- */
const sourceOSM = new OSM();
const sourceSatellite = new XYZ({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19
});
const sourceDark = new XYZ({
  url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
});

const baseLayer = new TileLayer({
  source: sourceOSM,
  zIndex: 0 // Layer paling bawah
});

/* --- 2. LAYER DATA (DENGAN Z-INDEX) --- */
// Kita beri zIndex tinggi (100) agar Ikon selalu di atas Polygon
const banjir = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: 'data/banjir.json' }),
  zIndex: 100, 
  style: new Style({
    image: new Icon(({
      anchor: [0.5, 1],
      src: 'icon/downpour.png', 
      width: 32, height: 32
    }))
  })
});

const genangan = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: 'data/csvjson.json' }),
  zIndex: 100,
  style: new Style({
    image: new Icon(({
      anchor: [0.5, 1],
      src: 'icon/banjir-icon.png',
      width: 32, height: 32
    }))
  })
});

// Layer Riau zIndex rendah (10) agar di bawah ikon
const riau = new VectorLayer({
  background: '#1a2b39',
  source: new VectorSource({ format: new GeoJSON(), url: 'data/polygon_riau.json' }),
  zIndex: 10, 
  style: {
    'fill-color': [
      'interpolate', ['linear'], ['get', 'OBJECTID'],
      1, 'rgba(255, 255, 51, 0.4)',
      1283, 'rgba(51, 88, 255, 0.4)',
    ],
    'stroke-color': 'rgba(255, 255, 255, 0.3)',
    'stroke-width': 1,
  },
});

/* --- 3. POPUP & MAP SETUP --- */
const container = document.getElementById('popup');
const content_element = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

const overlay = new Overlay({
  element: container,
  autoPan: { animation: { duration: 250 } },
  positioning: 'bottom-center',
  stopEvent: false,
  offset: [0, -10]
});

const defaultCenter = fromLonLat([101.438309, 0.510440]);
const defaultZoom = 9;

const map = new Map({
  target: 'map',
  layers: [ baseLayer, riau, banjir, genangan ],
  overlays: [overlay],
  view: new View({
    center: defaultCenter,
    zoom: defaultZoom,
  })
});

/* --- 4. HIGHLIGHT INTERACTION --- */
const featureOverlay = new VectorLayer({
  source: new VectorSource(),
  map: map,
  zIndex: 200, // Paling atas untuk highlight
  style: new Style({
    stroke: new Stroke({ color: '#00eaff', width: 3 }),
    fill: new Fill({ color: 'rgba(0, 234, 255, 0.1)' })
  }),
});

let highlight;

// Fungsi highlight juga perlu prioritas Point
const highlightFeature = function (pixel) {
  let pointFeature = null;
  let polygonFeature = null;

  // Cek semua fitur di pixel tersebut
  map.forEachFeatureAtPixel(pixel, function (feat) {
    const type = feat.getGeometry().getType();
    if (type === 'Point') {
      pointFeature = feat; // Simpan Point
      return true; // Stop loop jika ketemu point
    } 
    // Jika polygon, simpan dulu tapi jangan stop loop (siapa tau ada point di bawahnya)
    if (!polygonFeature) polygonFeature = feat;
  }, { hitTolerance: 5 });

  // Prioritaskan Point
  const feature = pointFeature || polygonFeature;

  if (feature !== highlight) {
    if (highlight) featureOverlay.getSource().removeFeature(highlight);
    if (feature) featureOverlay.getSource().addFeature(feature);
    highlight = feature;
  }
};

const displayFeatureInfo = function (pixel) {
  let pointFeature = null;
  let polygonFeature = null;

  map.forEachFeatureAtPixel(pixel, function (feat) {
    const type = feat.getGeometry().getType();
    if (type === 'Point') {
      pointFeature = feat;
      return true; 
    }
    if (!polygonFeature) polygonFeature = feat;
  }, { hitTolerance: 5 });

  const feature = pointFeature || polygonFeature;
  const info = document.getElementById('info');
  
  if (info) {
    if (feature) {
      const text = feature.get('KABUPATEN') || feature.get('Nama_Pemetaan') || 
                   feature.get('kecamatan') || feature.get('Kabupaten') || 
                   'Fitur Terdeteksi';
      info.innerHTML = text;
    } else {
      info.innerHTML = 'Arahkan kursor ke area...';
    }
  }
};

/* --- 5. EVENT LISTENERS PETA --- */
map.on('pointermove', function (evt) {
  if (evt.dragging) return;
  const pixel = map.getEventPixel(evt.originalEvent);
  highlightFeature(pixel);
  displayFeatureInfo(pixel);
});

// --- BAGIAN UTAMA YANG DIPERBAIKI (PRIORITAS KLIK) ---
map.on('singleclick', function (evt) {
  
  let pointFeature = null;
  let polygonFeature = null;

  // 1. Loop mencari fitur dengan prioritas
  map.forEachFeatureAtPixel(evt.pixel, function (feat) {
    const type = feat.getGeometry().getType();
    
    // Jika ketemu Point, ambil langsung dan berhenti mencari
    if (type === 'Point') {
      pointFeature = feat;
      return true; 
    }
    // Jika ketemu Polygon, simpan dulu sebagai cadangan
    if (type === 'Polygon' || type === 'MultiPolygon') {
      polygonFeature = feat;
    }
  }, { hitTolerance: 10 }); // Hit tolerance membantu jari/mouse meleset dikit

  // 2. Tentukan pemenang: Jika ada Point pakai Point, jika tidak pakai Polygon
  const feature = pointFeature || polygonFeature;

  if (!feature) {
    overlay.setPosition(undefined);
    closer.blur();
    return;
  }

  // --- LOGIKA POSISI POPUP ---
  const geometry = feature.getGeometry();
  const type = geometry.getType();
  let popupCoordinate;

  if (type === 'Point') {
    popupCoordinate = geometry.getCoordinates(); // Nempel di Ikon
  } else {
    popupCoordinate = evt.coordinate; // Nempel di kursor (untuk Polygon)
  }

  const props = feature.getProperties();
  let content = '';

  if (props.Nama_Pemetaan) {
    // Banjir
    content = `
      <div class="popup-header error">
        <h6 class="mb-0 fw-bold"><i class="ri-alert-fill me-1"></i> Lokasi Banjir</h6>
      </div>
      <div class="p-2">
         <table class="table table-dark table-sm table-borderless small mb-0" style="background:transparent">
           <tr><td class="text-secondary">Area</td><td class="fw-bold">${props.Nama_Pemetaan}</td></tr>
           <tr><td class="text-secondary">Korban</td><td class="text-danger fw-bold">${props.Jumlah_Korban || '-'} Jiwa</td></tr>
         </table>
      </div>`;
  } else if (props.kecamatan || props.jalan || props.coordinates) {
    // Genangan
    content = `
      <div class="popup-header warning">
        <h6 class="mb-0 fw-bold text-dark"><i class="ri-rainy-fill me-1"></i> Titik Genangan</h6>
      </div>
      <div class="p-2">
        <p class="mb-1 small text-secondary">Lokasi:</p>
        <p class="mb-0 fw-bold small">Kec. ${props.kecamatan || '-'}</p>
        <p class="mb-0 small text-white">Jl. ${props.jalan || '-'}</p>
        <p class="mb-0 small text-white">long: ${props.long || '-'}</p>
        <p class="mb-0 small text-white">lat: ${props.lat || '-'}</p>
      </div>`;
  } else {
    // Wilayah (Polygon)
    const nama = props.Kabupaten || props.KABUPATEN || props.DESA || 'Area Riau';
    content = `
      <div class="popup-header info">
        <h6 class="mb-0 fw-bold"><i class="ri-map-pin-line me-1"></i> Info Wilayah</h6>
      </div>
      <div class="p-2">
        <p class="mb-0 fw-bold">${nama}</p>
      </div>`;
  }

  content_element.innerHTML = content;
  overlay.setPosition(popupCoordinate);
  map.getView().animate({ center: popupCoordinate, duration: 400 });
});

closer.onclick = function () {
  overlay.setPosition(undefined); closer.blur(); return false;
};

/* --- 6. LOGIKA KONTROL UI --- */
const basemapSelect = document.getElementById('basemapSelect');
if(basemapSelect){
  basemapSelect.addEventListener('change', function(e) {
    const val = e.target.value;
    if(val === 'osm') baseLayer.setSource(sourceOSM);
    else if(val === 'sate') baseLayer.setSource(sourceSatellite);
    else if(val === 'dark') baseLayer.setSource(sourceDark);
  });
}

function searchLocation() {
  const keyword = document.getElementById('searchBox').value.toLowerCase();
  if(!keyword) return;

  const view = map.getView();
  
  const searchInLayer = (layer) => {
    const source = layer.getSource();
    if(source.getState() !== 'ready') return false;
    
    const features = source.getFeatures();
    for (let feat of features) {
      const props = feat.getProperties();
      const text = (props.kecamatan || props.jalan || props.Nama_Pemetaan || props.Kabupaten || '').toLowerCase();
      
      if (text.includes(keyword)) {
        const geometry = feat.getGeometry();
        if(geometry.getType() === 'Point') {
            const center = geometry.getCoordinates();
            view.animate({ center: center, zoom: 15, duration: 1000 });
        } else {
            const extent = geometry.getExtent();
            view.fit(extent, { padding: [100, 100, 100, 100], maxZoom: 15, duration: 1000 });
        }
        
        featureOverlay.getSource().clear();
        featureOverlay.getSource().addFeature(feat);
        return true; 
      }
    }
    return false;
  };

  if (!searchInLayer(genangan)) {
    if (!searchInLayer(banjir)) {
       if(!searchInLayer(riau)) {
         alert('Lokasi tidak ditemukan.');
       }
    }
  }
}

document.getElementById('btnSearch').addEventListener('click', searchLocation);
document.getElementById('searchBox').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchLocation();
});

document.getElementById('btnHome').addEventListener('click', () => {
  map.getView().animate({ center: defaultCenter, zoom: defaultZoom, duration: 1000 });
  featureOverlay.getSource().clear();
  overlay.setPosition(undefined);
});

document.getElementById('btnLocate').addEventListener('click', () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(function(position) {
      const pos = fromLonLat([position.coords.longitude, position.coords.latitude]);
      map.getView().animate({ center: pos, zoom: 14, duration: 1000 });
    }, function() {
      alert("Gagal mengambil lokasi.");
    });
  } else {
    alert("Browser tidak mendukung Geolocation.");
  }
});

document.getElementById('polygon').addEventListener('change', function () { riau.setVisible(this.checked); });
document.getElementById('point').addEventListener('change', function () { banjir.setVisible(this.checked); });
document.getElementById('point2').addEventListener('change', function () { genangan.setVisible(this.checked); });