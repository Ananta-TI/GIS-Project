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
import "ol/ol.css";
// import "./components/Navbar.js"; // Uncomment jika file ada

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
  zIndex: 0
});

/* --- 2. LAYER DATA --- */
const banjir = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: '/data/banjir.json' }),
  zIndex: 100,
  style: new Style({
    image: new Icon(({
      anchor: [0.5, 1],
      src: '/icon/downpour.png', // Pastikan file icon ada
      width: 32, height: 32
    }))
  })
});

const genangan = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: '/data/csvjson.json' }),
  zIndex: 100,
  style: new Style({
    image: new Icon(({
      anchor: [0.5, 1],
      src: '/icon/banjir-icon.png', // Pastikan file icon ada
      width: 32, height: 32
    }))
  })
});

const riau = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: '/data/polygon_riau.json' }),
  visible: false,
  zIndex: 10,
  style: {
    'fill-color': ['interpolate', ['linear'], ['get', 'OBJECTID'], 1, 'rgba(255, 255, 51, 0.4)', 1283, 'rgba(51, 88, 255, 0.4)'],
    'stroke-color': 'rgba(255, 255, 255, 0.3)',
    'stroke-width': 1,
  },
});

const pekanbaru = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: '/data/pekan.json' }),
  zIndex: 20,
  style: new Style({
    fill: new Fill({ color: 'rgba(255, 153, 0, 0.2)' }),
    stroke: new Stroke({ color: '#ff6600', width: 2 })
  }),
  properties: { name: 'pekanbaru' }
});

/* --- 3. POPUP CONFIGURATION --- */
const container = document.getElementById('popup');
const content_element = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

const overlay = new Overlay({
  element: container,
  autoPan: { animation: { duration: 250 }, margin: 20 },
  positioning: 'bottom-center',
  stopEvent: true,
  offset: [0, -10]
});

const defaultCenter = fromLonLat([101.438309, 0.510440]);
const defaultZoom = 13;

const map = new Map({
  target: 'map',
  layers: [baseLayer, riau, pekanbaru, banjir, genangan],
  overlays: [overlay],
  view: new View({ center: defaultCenter, zoom: defaultZoom })
});

/* --- 4. HIGHLIGHT INTERACTION --- */
const featureOverlay = new VectorLayer({
  source: new VectorSource(),
  map: map,
  zIndex: 200,
  style: new Style({
    stroke: new Stroke({ color: '#00eaff', width: 3 }),
    fill: new Fill({ color: 'rgba(0, 234, 255, 0.1)' })
  }),
});

let highlight;
const highlightFeature = function (pixel) {
  let pointFeature = null;
  let polygonFeature = null;
  map.forEachFeatureAtPixel(pixel, function (feat) {
    const type = feat.getGeometry().getType();
    if (type === 'Point') { pointFeature = feat; return true; }
    if (!polygonFeature) polygonFeature = feat;
  }, { hitTolerance: 5 });

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
    if (type === 'Point') { pointFeature = feat; return true; }
    if (!polygonFeature) polygonFeature = feat;
  }, { hitTolerance: 5 });

  const feature = pointFeature || polygonFeature;
  const info = document.getElementById('info');
  if (info) {
    if (feature) {
        const props = feature.getProperties();
        const text = props.Nama_Pemetaan || props.kecamatan || props.Nama_Kec || props.KECAMATAN || 'Fitur Terdeteksi';
        info.innerHTML = text;
    } else {
        info.innerHTML = 'Klik objek pada peta...';
    }
  }
};

/* --- 5. EVENT LISTENERS --- */
map.on('pointermove', function (evt) {
  if (evt.dragging) return;
  const pixel = map.getEventPixel(evt.originalEvent);
  highlightFeature(pixel);
  displayFeatureInfo(pixel);
});

map.on('singleclick', function (evt) {
  let pointFeature = null;
  let polygonFeature = null;
  map.forEachFeatureAtPixel(evt.pixel, function (feat) {
    const type = feat.getGeometry().getType();
    if (type === 'Point') { pointFeature = feat; return true; }
    if (type === 'Polygon' || type === 'MultiPolygon') { polygonFeature = feat; }
  }, { hitTolerance: 10 });

  const feature = pointFeature || polygonFeature;
  if (!feature) {
    overlay.setPosition(undefined); closer.blur(); return;
  }

  const geometry = feature.getGeometry();
  const type = geometry.getType();
  let popupCoordinate = (type === 'Point') ? geometry.getCoordinates() : evt.coordinate;

  const props = feature.getProperties();
  let content = '';
  const isPekanbaruFeature = props.Nama_Kec !== undefined || props.NAMOBJ !== undefined;

  // Render HTML Popup (Menggunakan Bootstrap classes)
  if (props.Nama_Pemetaan) {
    content = `
      <h3><i class="ri-alarm-warning-fill text-danger"></i> Lokasi Banjir</h3>
      <div class="mt-2">
        <p class="mb-1 fw-bold text-white fs-5">${props.Nama_Pemetaan}</p>
        <div class="d-flex justify-content-between align-items-center mt-2 p-2 rounded" style="background: rgba(255,255,255,0.05)">
            <span class="text-muted small">Terdampak</span>
            <span class="badge bg-danger text-white">${props.Jumlah_Korban || '0'} Jiwa</span>
        </div>
      </div>`;
  } else if (props.kecamatan || props.jalan) {
    content = `
      <h3><i class="ri-rainy-line text-info"></i> Titik Genangan</h3>
      <div class="mt-2">
         <p class="mb-1 fw-bold text-white">Kec. ${props.kecamatan || '-'}</p>
         <p class="text-secondary small mb-2"><i class="ri-map-pin-line"></i> Jl. ${props.jalan || '-'}</p>
      </div>`;
  } else if (isPekanbaruFeature) {
    content = `
      <h3><i class="ri-building-2-fill text-warning"></i> Pekanbaru</h3>
      <div class="mt-2">
        <p class="mb-1 fw-bold text-white fs-5">${props.Nama_Kec || props.NAMOBJ || '-'}</p>
        <p class="text-secondary small">Kab: ${props.Nama_Kab || props.WADMKD || '-'}</p>
      </div>`;
  } else {
    content = `
      <h3><i class="ri-map-2-line"></i> Info Wilayah</h3>
      <div class="mt-2">
        <p class="mb-0 text-white">Kec: ${props.KECAMATAN || '-'}</p>
        <p class="mb-0 text-secondary small">Kab: ${props.KABUPATEN || '-'}</p>
      </div>`;
  }

  content_element.innerHTML = content;
  overlay.setPosition(popupCoordinate);
  
  // Animasi pan ke popup
  map.getView().animate({ center: popupCoordinate, duration: 500, easing: (t) => t * (2 - t) });
});

closer.onclick = function (e) {
  e.preventDefault();
  overlay.setPosition(undefined); closer.blur(); return false;
};

/* --- 6. UTILITIES (Search & Location) --- */
const basemapSelect = document.getElementById('basemapSelect');
if (basemapSelect) {
  basemapSelect.addEventListener('change', function (e) {
    const val = e.target.value;
    if (val === 'osm') baseLayer.setSource(sourceOSM);
    else if (val === 'sate') baseLayer.setSource(sourceSatellite);
    else if (val === 'dark') baseLayer.setSource(sourceDark);
  });
}

function searchLocation() {
  const keyword = document.getElementById('searchBox').value.toLowerCase();
  if (!keyword) return;
  const view = map.getView();
  
  const searchInLayer = (layer) => {
    const source = layer.getSource();
    if (source.getState() !== 'ready') return false;
    const features = source.getFeatures();
    for (let feat of features) {
      const props = feat.getProperties();
      const text = (props.kecamatan || props.Nama_Kec || props.KECAMATAN || props.jalan || props.Nama_Pemetaan || '').toLowerCase();
      if (text.includes(keyword)) {
        const geometry = feat.getGeometry();
        if (geometry.getType() === 'Point') {
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
  
  if (!searchInLayer(genangan) && !searchInLayer(banjir) && !searchInLayer(pekanbaru)) {
     alert('Lokasi tidak ditemukan.');
  }
}

document.getElementById('btnSearch').addEventListener('click', searchLocation);
document.getElementById('searchBox').addEventListener('keypress', (e) => { if (e.key === 'Enter') searchLocation(); });

document.getElementById('btnHome').addEventListener('click', () => {
  map.getView().animate({ center: defaultCenter, zoom: defaultZoom, duration: 1000 });
  featureOverlay.getSource().clear(); overlay.setPosition(undefined);
});

document.getElementById('btnLocate').addEventListener('click', () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(function (position) {
      const pos = fromLonLat([position.coords.longitude, position.coords.latitude]);
      map.getView().animate({ center: pos, zoom: 14, duration: 1000 });
    });
  } else { alert("Geolocation tidak didukung."); }
});

// Kontrol Layer
document.getElementById('polygon').addEventListener('change', function () { riau.setVisible(this.checked); });
document.getElementById('pekanbaru').addEventListener('change', function () { pekanbaru.setVisible(this.checked); });
document.getElementById('point').addEventListener('change', function () { banjir.setVisible(this.checked); });
document.getElementById('point2').addEventListener('change', function () { genangan.setVisible(this.checked); });

/* --- 7. LINKED FILTER SYSTEM --- */
const genanganSource = genangan.getSource();
const pekanbaruSource = pekanbaru.getSource();
let allGenanganFeatures = [];
let allPekanbaruFeatures = [];

function createCheckboxes(sourceFeatures, containerId, idPrefix, propertyName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const items = new Set();
    sourceFeatures.forEach(f => {
        const val = f.get(propertyName);
        if(val) items.add(val);
    });
    
    container.innerHTML = '';
    Array.from(items).sort().forEach(item => {
        const div = document.createElement('div');
        div.className = 'form-check mb-1';
        div.innerHTML = `
            <input class="form-check-input" type="checkbox" value="${item}" id="${idPrefix}-${item.replace(/\s+/g, '-')}">
            <label class="form-check-label text-light small" for="${idPrefix}-${item.replace(/\s+/g, '-')}">${item}</label>
        `;
        container.appendChild(div);
    });
}

function filterLayer(source, allFeatures, containerId, propertyName) {
    const checked = Array.from(document.querySelectorAll(`#${containerId} input:checked`)).map(cb => cb.value);
    source.clear();
    if(checked.length === 0) source.addFeatures(allFeatures);
    else source.addFeatures(allFeatures.filter(f => checked.includes(f.get(propertyName))));
}

function handleFilterInteraction(event) {
    const cb = event.target;
    const val = cb.value;
    const checked = cb.checked;
    
    // Sync checkboxes
    const sourceId = cb.closest('.filter-scroll').id;
    const targetId = sourceId === 'genanganCheckboxes' ? 'pekanbaruCheckboxes' : 'genanganCheckboxes';
    const targetCb = document.querySelector(`#${targetId} input[value="${val}"]`);
    if(targetCb) targetCb.checked = checked;
    
    // Apply filters
    filterLayer(genanganSource, allGenanganFeatures, 'genanganCheckboxes', 'kecamatan');
    filterLayer(pekanbaruSource, allPekanbaruFeatures, 'pekanbaruCheckboxes', 'Nama_Kec');
}

function setupFilters() {
    createCheckboxes(allGenanganFeatures, 'genanganCheckboxes', 'gen', 'kecamatan');
    createCheckboxes(allPekanbaruFeatures, 'pekanbaruCheckboxes', 'pku', 'Nama_Kec');
    
    ['genanganCheckboxes', 'pekanbaruCheckboxes'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', handleFilterInteraction);
    });
}

// Loader
let loadedCount = 0;
function checkLoad() {
    loadedCount++;
    if(loadedCount >= 2) setupFilters();
}

genanganSource.once('change', () => { 
    if(genanganSource.getState() === 'ready') { allGenanganFeatures = genanganSource.getFeatures(); checkLoad(); } 
});
pekanbaruSource.once('change', () => { 
    if(pekanbaruSource.getState() === 'ready') { allPekanbaruFeatures = pekanbaruSource.getFeatures(); checkLoad(); } 
});