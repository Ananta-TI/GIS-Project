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
import "./components/Navbar.js";



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

/* --- 2. LAYER DATA (DENGAN Z-INDEX) --- */
const banjir = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: './public/data/banjir.json' }),
  zIndex: 100,
  style: new Style({
    image: new Icon(({
      anchor: [0.5, 1],
      src: './public/icon/downpour.png',
      width: 32, height: 32
    }))
  })
});

const genangan = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: './public/data/csvjson.json' }),
  zIndex: 100,
  style: new Style({
    image: new Icon(({
      anchor: [0.5, 1],
      src: './public/icon/banjir-icon.png',
      width: 32, height: 32
    }))
  })
});

const riau = new VectorLayer({
  source: new VectorSource({ format: new GeoJSON(), url: './public/data/polygon_riau.json' }),
  visible: false, // Layer akan disembunyikan saat pertama kali dimuat
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

const pekanbaru = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: './public/data/pekan.json'
  }),
  zIndex: 20,
  style: new Style({
    fill: new Fill({
      color: 'rgba(255, 153, 0, 0.3)'
    }),
    stroke: new Stroke({
      color: '#ff6600',
      width: 2
    })
  }),
  properties: {
    name: 'pekanbaru'
  }
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
const defaultZoom = 13;

const map = new Map({
  target: 'map',
  layers: [baseLayer, riau, pekanbaru, banjir, genangan],
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
    if (type === 'Point') {
      pointFeature = feat;
      return true;
    }
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
                   feature.get('KECAMATAN') || feature.get('Nama_Kec') ||
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

map.on('singleclick', function (evt) {
  let pointFeature = null;
  let polygonFeature = null;
  map.forEachFeatureAtPixel(evt.pixel, function (feat) {
    const type = feat.getGeometry().getType();
    if (type === 'Point') {
      pointFeature = feat;
      return true;
    }
    if (type === 'Polygon' || type === 'MultiPolygon') {
      polygonFeature = feat;
    }
  }, { hitTolerance: 10 });

  const feature = pointFeature || polygonFeature;
  if (!feature) {
    overlay.setPosition(undefined);
    closer.blur();
    return;
  }

  const geometry = feature.getGeometry();
  const type = geometry.getType();
  let popupCoordinate = (type === 'Point') ? geometry.getCoordinates() : evt.coordinate;

  const props = feature.getProperties();
  let content = '';

  const isPekanbaruFeature = props.Nama_Kec !== undefined || props.NAMOBJ !== undefined;

  if (props.Nama_Pemetaan) {
    content = `<div class="popup-header error"><h6 class="mb-0 fw-bold"><i class="ri-alert-fill me-1"></i> Lokasi Banjir</h6></div><div class="p-2"><table class="table table-dark table-sm table-borderless small mb-0" style="background:transparent"><tr><td class="text-secondary">Area</td><td class="fw-bold">${props.Nama_Pemetaan}</td></tr><tr><td class="text-secondary">Korban</td><td class="text-danger fw-bold">${props.Jumlah_Korban || '-'} Jiwa</td></tr></table></div>`;
  } else if (props.kecamatan || props.jalan || props.coordinates) {
    content = `<div class="popup-header warning"><h6 class="mb-0 fw-bold text-dark"><i class="ri-rainy-fill me-1"></i> Titik Genangan</h6></div><div class="p-2"><p class="mb-1 small text-secondary">Lokasi:</p><p class="mb-0 fw-bold small">Kec. ${props.kecamatan || '-'}</p><p class="mb-0 small text-white">Jl. ${props.jalan || '-'}</p><p class="mb-0 small text-white">long: ${props.long || '-'}</p><p class="mb-0 small text-white">lat: ${props.lat || '-'}</p></div>`;
  } else if (isPekanbaruFeature) {
    content = `<div class="popup-header info"><h6 class="mb-0 fw-bold"><i class="ri-map-pin-line me-1"></i> Wilayah Pekanbaru</h6></div><div class="p-2"><p class="mb-0 fw-bold">${props.Nama_Kec || props.NAMOBJ || '-'}</p><p class="mb-0 small text-white">Kabupaten: ${props.Nama_Kab || props.WADMKD || '-'}</p><p class="mb-0 small text-white">Provinsi: ${props.Nama_Prov || '-'}</p></div>`;
  } else {
    const nama = props.KECAMATAN || props.DESA || 'Area Riau';
    content = `<div class="popup-header info"><h6 class="mb-0 fw-bold"><i class="ri-map-pin-line me-1"></i> Info Wilayah Riau</h6></div><div class="p-2"><p class="mb-0 fw-bold">${nama}</p><p class="mb-0 small text-white">Kecamatan: ${props.KECAMATAN || '-'}</p><p class="mb-0 small text-white">Kabupaten: ${props.KABUPATEN || '-'}</p></div>`;
  }

  content_element.innerHTML = content;
  overlay.setPosition(popupCoordinate);
  map.getView().animate({ center: popupCoordinate, duration: 400 });
});

closer.onclick = function () {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

/* --- 6. LOGIKA KONTROL UI --- */
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
      const text = (props.kecamatan || props.Nama_Kec || props.KECAMATAN || props.jalan || props.Nama_Pemetaan || props.Kabupaten || props.NAMOBJ || '').toLowerCase();
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
  if (!searchInLayer(genangan)) {
    if (!searchInLayer(banjir)) {
      if (!searchInLayer(pekanbaru)) {
        if (!searchInLayer(riau)) {
          alert('Lokasi tidak ditemukan.');
        }
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
    navigator.geolocation.getCurrentPosition(function (position) {
      const pos = fromLonLat([position.coords.longitude, position.coords.latitude]);
      map.getView().animate({ center: pos, zoom: 14, duration: 1000 });
    }, function () {
      alert("Gagal mengambil lokasi.");
    });
  } else {
    alert("Browser tidak mendukung Geolocation.");
  }
});

// Kontrol untuk layer Riau
document.getElementById('polygon').addEventListener('change', function () {
  riau.setVisible(this.checked);
});
// Kontrol untuk layer Pekanbaru
document.getElementById('pekanbaru').addEventListener('change', function () {
  pekanbaru.setVisible(this.checked);
});
// Kontrol untuk layer Banjir
document.getElementById('point').addEventListener('change', function () { banjir.setVisible(this.checked); });
// Kontrol untuk layer Genangan (SUDAH DIPERBAIKI ID-NYA)
document.getElementById('point2').addEventListener('change', function () { genangan.setVisible(this.checked); });


/* --- 7. LOGIKA FILTER TERHUBUNG (GANTI BAGIAN INI) --- */

const genanganSource = genangan.getSource();
const pekanbaruSource = pekanbaru.getSource();

let allGenanganFeatures = [];
let allPekanbaruFeatures = [];

// Fungsi untuk membuat checkbox Genangan
function createGenanganCheckboxes() {
  const checkboxContainer = document.getElementById('genanganCheckboxes');
  if (!checkboxContainer) return;

  const districts = new Set();
  allGenanganFeatures.forEach(feature => {
    const district = feature.get('kecamatan');
    if (district) districts.add(district);
  });

  checkboxContainer.innerHTML = '';
  Array.from(districts).sort().forEach(district => {
    const div = document.createElement('div');
    div.className = 'form-check form-check-inline mb-2';

    const input = document.createElement('input');
    input.className = 'form-check-input';
    input.type = 'checkbox';
    input.value = district;
    input.id = `genangan-${district.replace(/\s+/g, '-')}`;

    const label = document.createElement('label');
    label.className = 'form-check-label text-light small';
    label.htmlFor = input.id;
    label.textContent = district;

    div.appendChild(input);
    div.appendChild(label);
    checkboxContainer.appendChild(div);
  });
}

// Fungsi untuk membuat checkbox Pekanbaru
function createPekanbaruCheckboxes() {
  const checkboxContainer = document.getElementById('pekanbaruCheckboxes');
  if (!checkboxContainer) return;

  const districts = new Set();
  allPekanbaruFeatures.forEach(feature => {
    const district = feature.get('Nama_Kec');
    if (district) districts.add(district);
  });

  checkboxContainer.innerHTML = '';
  Array.from(districts).sort().forEach(district => {
    const div = document.createElement('div');
    div.className = 'form-check form-check-inline mb-2';

    const input = document.createElement('input');
    input.className = 'form-check-input';
    input.type = 'checkbox';
    input.value = district;
    input.id = `pekanbaru-${district.replace(/\s+/g, '-')}`;

    const label = document.createElement('label');
    label.className = 'form-check-label text-light small';
    label.htmlFor = input.id;
    label.textContent = district;

    div.appendChild(input);
    div.appendChild(label);
    checkboxContainer.appendChild(div);
  });
}

// Fungsi filter untuk Genangan
function filterGenanganByDistrict() {
  const checkedBoxes = document.querySelectorAll('#genanganCheckboxes input[type="checkbox"]:checked');
  const selectedDistricts = Array.from(checkedBoxes).map(cb => cb.value);

  genanganSource.clear();
  if (selectedDistricts.length === 0) {
    genanganSource.addFeatures(allGenanganFeatures);
  } else {
    const filteredFeatures = allGenanganFeatures.filter(feature =>
      selectedDistricts.includes(feature.get('kecamatan'))
    );
    genanganSource.addFeatures(filteredFeatures);
  }
}

// Fungsi filter untuk Pekanbaru
function filterPekanbaruByDistrict() {
  const checkedBoxes = document.querySelectorAll('#pekanbaruCheckboxes input[type="checkbox"]:checked');
  const selectedDistricts = Array.from(checkedBoxes).map(cb => cb.value);

  pekanbaruSource.clear();
  if (selectedDistricts.length === 0) {
    pekanbaruSource.addFeatures(allPekanbaruFeatures);
  } else {
    const filteredFeatures = allPekanbaruFeatures.filter(feature =>
      selectedDistricts.includes(feature.get('Nama_Kec'))
    );
    pekanbaruSource.addFeatures(filteredFeatures);
  }
}

// *** FUNGSI BARU UNTUK MENGHUBUNGKAN FILTER ***
function handleFilterInteraction(event) {
  // 1. Dapatkan info dari checkbox yang diubah
  const changedCheckbox = event.target;
  const district = changedCheckbox.value;
  const isChecked = changedCheckbox.checked;

  // 2. Tentukan container mana asal perubahan dan mana targetnya
  const sourceContainerId = changedCheckbox.closest('#genanganCheckboxes, #pekanbaruCheckboxes').id;
  const targetContainerId = sourceContainerId === 'genanganCheckboxes' ? 'pekanbaruCheckboxes' : 'genanganCheckboxes';

  // 3. Cari checkbox yang sesuai di container lain dan sinkronkan statusnya
  const correspondingCheckbox = document.querySelector(`#${targetContainerId} input[value="${district}"]`);
  if (correspondingCheckbox && correspondingCheckbox.checked !== isChecked) {
    correspondingCheckbox.checked = isChecked;
  }

  // 4. Jalankan ulang filter untuk KEDUA layer untuk memastikan semuanya sinkron
  filterGenanganByDistrict();
  filterPekanbaruByDistrict();
}

// Fungsi untuk menyiapkan event listener setelah checkbox dibuat
function setupFilterListeners() {
  const genanganContainer = document.getElementById('genanganCheckboxes');
  const pekanbaruContainer = document.getElementById('pekanbaruCheckboxes');

  if (genanganContainer) {
    genanganContainer.addEventListener('change', handleFilterInteraction);
  }
  if (pekanbaruContainer) {
    pekanbaruContainer.addEventListener('change', handleFilterInteraction);
  }
}

// Muat data dan inisialisasi semuanya
let loadedSources = 0;
function onSourceLoaded() {
  loadedSources++;
  if (loadedSources === 2) {
    createGenanganCheckboxes();
    createPekanbaruCheckboxes();
    setupFilterListeners(); // Pasang listener baru
    filterGenanganByDistrict(); // Tampilkan semua data awal
    filterPekanbaruByDistrict(); // Tampilkan semua data awal
  }
}

genanganSource.once('change', function () {
  if (genanganSource.getState() === 'ready') {
    allGenanganFeatures = genanganSource.getFeatures();
    onSourceLoaded();
  }
});

pekanbaruSource.once('change', function () {
  if (pekanbaruSource.getState() === 'ready') {
    allPekanbaruFeatures = pekanbaruSource.getFeatures();
    onSourceLoaded();
  }
});