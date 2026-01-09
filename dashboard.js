// dashboard.js
// Hapus import Navbar jika file tersebut belum ada atau menyebabkan error, 
// tapi biarkan jika strukturnya sudah benar.
import "./components/Navbar.js";

// Global Variables
let banjirData, genanganData, riauData, newsData, pekanData;
let allPointData = [];
let filteredData = [];
let victimsChart = null;
let classificationChart = null;
let miniMap = null;

// Akses OpenLayers dari window object untuk keamanan di dalam module
const ol = window.ol;

document.addEventListener('DOMContentLoaded', async () => {
    showLoadingSpinner();

    try {
        // --- 1. DATA LOADING (Dengan Fallback ke Dummy Data) ---
        await loadData();

        // --- 2. METRIC CALCULATION ---
        calculateAndDisplayMetrics();

        // --- 3. POPULATE COMPONENTS ---
        populateNewsSection();
        
        // --- 4. CHARTS ---
        initCharts();

        // --- 5. DATA TABLE ---
        initializeDataTable();

        // --- 6. MAP ---
        initializeMiniMap();

        // --- 7. EVENT LISTENERS ---
        setupEventListeners();

        showSuccessNotification('Dashboard berhasil dimuat!');

    } catch (error) {
        console.error('Critical Error:', error);
        showErrorNotification('Terjadi kesalahan fatal. Cek konsol.');
    } finally {
        hideLoadingSpinner();
    }
});

// --- CORE FUNCTIONS ---

async function loadData() {
    try {
        // Coba fetch file asli
        const [banjirRes, genanganRes, riauRes, newsRes] = await Promise.all([
            fetch('data/banjir.json').then(r => r.ok ? r.json() : null),
            fetch('data/csvjson.json').then(r => r.ok ? r.json() : null),
            fetch('data/polygon_riau.json').then(r => r.ok ? r.json() : null),
            fetch('data/news.json').then(r => r.ok ? r.json() : null)
        ]);

        // Jika fetch gagal (null), gunakan Dummy Data Generator
        if (!banjirRes || !genanganRes) {
            console.warn("File JSON tidak ditemukan, menggunakan Dummy Data.");
            generateDummyData();
        } else {
            banjirData = banjirRes;
            genanganData = genanganRes;
            riauData = riauRes || { features: [] }; // Fallback kosong
            newsData = newsRes || [];
        }

    } catch (e) {
        console.error("Fetch error, switching to dummy data", e);
        generateDummyData();
    }
}

function generateDummyData() {
    // Membuat data palsu untuk testing jika file JSON hilang
    const centerLat = 0.5071;
    const centerLon = 101.4478;

    banjirData = { type: "FeatureCollection", features: [] };
    genanganData = { type: "FeatureCollection", features: [] };
    
    // Generate 10 titik banjir dummy
    for(let i=0; i<10; i++) {
        banjirData.features.push({
            type: "Feature",
            properties: {
                Nama_Pemetaan: `Lokasi Banjir ${i+1}`,
                kecamatan: i % 2 === 0 ? "Tampan" : "Marpoyan Damai",
                Jumlah_Korban: Math.floor(Math.random() * 50) + 10
            },
            geometry: {
                type: "Point",
                coordinates: [centerLon + (Math.random() * 0.1), centerLat + (Math.random() * 0.1)]
            }
        });
    }

    // Generate 5 titik genangan dummy
    for(let i=0; i<5; i++) {
        genanganData.features.push({
            type: "Feature",
            properties: {
                jalan: `Jalan Genangan ${i+1}`,
                kecamatan: "Sukajadi",
                Jumlah_Korban: 0
            },
            geometry: {
                type: "Point",
                coordinates: [centerLon - (Math.random() * 0.1), centerLat - (Math.random() * 0.1)]
            }
        });
    }

    riauData = { features: [
        { properties: { STATUS_KOT: "Rawan Tinggi" } },
        { properties: { STATUS_KOT: "Rawan Sedang" } },
        { properties: { STATUS_KOT: "Rawan Tinggi" } },
        { properties: { STATUS_KOT: "Aman" } }
    ]};

    newsData = [
        { title: "Banjir Surut di Pekanbaru", description: "Air mulai surut setelah 3 hari.", url: "#", publishedAt: new Date().toISOString() },
        { title: "Waspada Curah Hujan Tinggi", description: "BMKG memperingatkan potensi hujan.", url: "#", publishedAt: new Date().toISOString() }
    ];
}

function calculateAndDisplayMetrics() {
    allPointData = [...(banjirData?.features || []), ...(genanganData?.features || [])];
    filteredData = [...allPointData];

    const totalFloodPoints = banjirData?.features?.length || 0;
    const totalWaterloggingPoints = genanganData?.features?.length || 0;
    const totalVictims = banjirData?.features?.reduce((sum, f) => sum + (parseInt(f.properties.Jumlah_Korban) || 0), 0);
    
    const districts = new Set();
    allPointData.forEach(f => {
        if(f.properties.kecamatan) districts.add(f.properties.kecamatan);
    });

    updateMetricCard('totalFloodPoints', totalFloodPoints);
    updateMetricCard('totalWaterloggingPoints', totalWaterloggingPoints);
    updateMetricCard('totalVictims', totalVictims);
    updateMetricCard('affectedDistricts', districts.size);
}

function initCharts() {
    // --- Bar Chart ---
    const victimsByLocation = {};
    banjirData.features.forEach(f => {
        const loc = f.properties.Nama_Pemetaan || "Unknown";
        victimsByLocation[loc] = (victimsByLocation[loc] || 0) + (parseInt(f.properties.Jumlah_Korban) || 0);
    });

    const vCtx = document.getElementById('victimsChart');
    if (vCtx) {
        // Destroy existing chart if exists using Chart.js v3+ method
        const existingChart = Chart.getChart(vCtx);
        if (existingChart) existingChart.destroy();

        victimsChart = new Chart(vCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(victimsByLocation),
                datasets: [{
                    label: 'Jumlah Korban',
                    data: Object.values(victimsByLocation),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#444' } },
                    x: { grid: { color: '#444' } }
                },
                plugins: { legend: { labels: { color: 'white' } } }
            }
        });
    }

    // --- Doughnut Chart ---
    const classCount = {};
    riauData.features.forEach(f => {
        const status = f.properties.STATUS_KOT || "Tidak Terklasifikasi";
        classCount[status] = (classCount[status] || 0) + 1;
    });

    const cCtx = document.getElementById('classificationChart');
    if (cCtx) {
        const existingPie = Chart.getChart(cCtx);
        if (existingPie) existingPie.destroy();

        classificationChart = new Chart(cCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(classCount),
                datasets: [{
                    data: Object.values(classCount),
                    backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'],
                    borderColor: '#212529'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: 'white' } } }
            }
        });
    }
}

function initializeMiniMap() {
    // CHECK PENTING: Pastikan OpenLayers dimuat
    if (!ol) {
        showErrorNotification("Library Peta (OpenLayers) gagal dimuat.");
        return;
    }

    // Hapus konten map lama jika ada (untuk refresh)
    const mapTarget = document.getElementById('miniMap');
    mapTarget.innerHTML = '';

    // Sumber Data Banjir
    const banjirSource = new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(banjirData, {
            featureProjection: 'EPSG:3857'
        })
    });

    // Sumber Data Genangan
    const genanganSource = new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(genanganData, {
            featureProjection: 'EPSG:3857'
        })
    });

    // Style Banjir (Merah)
    const banjirStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 7,
            fill: new ol.style.Fill({ color: 'red' }),
            stroke: new ol.style.Stroke({ color: 'white', width: 2 })
        })
    });

    // Style Genangan (Biru)
    const genanganStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({ color: 'blue' }),
            stroke: new ol.style.Stroke({ color: 'white', width: 1 })
        })
    });

    // Inisialisasi Peta
    miniMap = new ol.Map({
        target: 'miniMap',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            }),
            new ol.layer.Vector({
                source: banjirSource,
                style: banjirStyle
            }),
            new ol.layer.Vector({
                source: genanganSource,
                style: genanganStyle
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([101.4478, 0.5071]), // Koordinat Pekanbaru
            zoom: 12
        })
    });

    // --- POPUP LOGIC ---
    const container = document.createElement('div');
    container.className = 'ol-popup';
    container.id = 'popup';
    document.body.appendChild(container); // Append ke body agar tidak tertutup overflow map

    const content = document.createElement('div');
    container.appendChild(content);

    const closer = document.createElement('a');
    closer.className = 'ol-popup-closer';
    closer.href = '#';
    container.appendChild(closer);

    const overlay = new ol.Overlay({
        element: container,
        autoPan: {
            animation: {
                duration: 250,
            },
        },
    });
    miniMap.addOverlay(overlay);

    closer.onclick = function () {
        overlay.setPosition(undefined);
        closer.blur();
        return false;
    };

    miniMap.on('singleclick', function (evt) {
        const feature = miniMap.forEachFeatureAtPixel(evt.pixel, function (feat) {
            return feat;
        });

        if (feature) {
            const props = feature.getProperties();
            const coordinate = evt.coordinate;
            
            const nama = props.Nama_Pemetaan || props.jalan || 'Tanpa Nama';
            const kec = props.kecamatan || '-';
            const korban = props.Jumlah_Korban || 0;
            const status = props.Nama_Pemetaan ? 'Banjir' : 'Genangan';

            content.innerHTML = `
                <h6 class="mb-1 fw-bold text-dark">${status}</h6>
                <hr class="my-1">
                <p class="mb-0 small text-dark"><strong>Lokasi:</strong> ${nama}</p>
                <p class="mb-0 small text-dark"><strong>Kecamatan:</strong> ${kec}</p>
                <p class="mb-0 small text-dark"><strong>Korban:</strong> ${korban} Jiwa</p>
            `;
            overlay.setPosition(coordinate);
        } else {
            overlay.setPosition(undefined);
        }
    });
}

function initializeDataTable() {
    const tableBody = document.getElementById('dataTableBody');
    const pagination = document.querySelector('.pagination');
    const itemsPerPage = 5;
    let currentPage = 1;

    // Search Logic
    document.getElementById('tableSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        filteredData = allPointData.filter(item => {
            const props = item.properties;
            const txt = (props.Nama_Pemetaan || props.jalan || '') + ' ' + (props.kecamatan || '');
            return txt.toLowerCase().includes(term);
        });
        currentPage = 1;
        renderTable();
    });

    function renderTable() {
        tableBody.innerHTML = '';
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageData = filteredData.slice(start, end);

        if (pageData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Tidak ada data ditemukan</td></tr>';
            return;
        }

        pageData.forEach((item) => {
            const props = item.properties;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge ${props.Nama_Pemetaan ? 'bg-danger' : 'bg-info'}">${props.Nama_Pemetaan ? 'Banjir' : 'Genangan'}</span></td>
                <td>${props.Nama_Pemetaan || props.jalan || '-'}</td>
                <td>${props.kecamatan || '-'}</td>
                <td>${props.Jumlah_Korban || 0}</td>
                <td>
                    <button class="btn btn-sm btn-outline-light view-map-btn">
                        <i class="ri-map-pin-line"></i>
                    </button>
                </td>
            `;
            
            // Event listener untuk tombol view map di dalam row
            const btn = tr.querySelector('.view-map-btn');
            btn.addEventListener('click', () => {
                if(miniMap && item.geometry && item.geometry.coordinates) {
                   const coords = ol.proj.fromLonLat(item.geometry.coordinates);
                   miniMap.getView().animate({ center: coords, zoom: 15 });
                   // Scroll ke map
                   document.getElementById('miniMap').scrollIntoView({behavior: 'smooth'});
                }
            });

            tableBody.appendChild(tr);
        });
        
        renderPagination();
    }

    function renderPagination() {
        pagination.innerHTML = '';
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        
        // Prev
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link bg-dark border-secondary text-light" href="#">Prev</a>`;
        prevLi.onclick = (e) => { e.preventDefault(); if(currentPage > 1) { currentPage--; renderTable(); }};
        pagination.appendChild(prevLi);

        // Next
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link bg-dark border-secondary text-light" href="#">Next</a>`;
        nextLi.onclick = (e) => { e.preventDefault(); if(currentPage < totalPages) { currentPage++; renderTable(); }};
        pagination.appendChild(nextLi);
    }

    renderTable();
}

function populateNewsSection() {
    const container = document.getElementById('newsContainer');
    container.innerHTML = '';
    
    // Tampilkan maksimal 4 berita
    const items = newsData.slice(0, 4);
    
    if (items.length === 0) {
        container.innerHTML = '<p class="text-muted p-3">Belum ada berita terkini.</p>';
        return;
    }

    items.forEach(news => {
        const col = document.createElement('div');
        col.className = 'col-md-6 mb-3';
        col.innerHTML = `
            <div class="p-3 border border-secondary rounded bg-dark-subtle">
                <h6 class="fw-bold text-light mb-1">${news.title}</h6>
                <small class="text-muted d-block mb-2">${new Date(news.publishedAt).toLocaleDateString()}</small>
                <p class="small text-secondary mb-2 text-truncate">${news.description}</p>
                <a href="${news.url}" class="btn btn-sm btn-link p-0">Baca selengkapnya &rarr;</a>
            </div>
        `;
        container.appendChild(col);
    });
}

// --- UTILITIES ---

function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', () => {
        location.reload();
    });
    
    document.getElementById('exportBtn').addEventListener('click', () => {
        const dataStr = JSON.stringify(allPointData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "floodguard_data_export.json";
        a.click();
        showSuccessNotification("Data berhasil diekspor!");
    });
}

function showLoadingSpinner() {
    // Implementasi spinner sederhana jika belum ada di HTML
    let spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;color:white;';
        spinner.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
        document.body.appendChild(spinner);
    }
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.remove();
}

function updateMetricCard(id, targetValue) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let current = 0;
    const increment = Math.ceil(targetValue / 20); // Animasi sederhana
    const timer = setInterval(() => {
        current += increment;
        if (current >= targetValue) {
            current = targetValue;
            clearInterval(timer);
        }
        el.innerText = current;
    }, 30);
}

function showSuccessNotification(msg) {
    // Bisa diganti dengan Toast Bootstrap atau alert sederhana
    console.log("Success:", msg);
}

function showErrorNotification(msg) {
    alert(msg);
}