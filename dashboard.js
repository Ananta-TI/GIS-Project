import "./components/Navbar.js";

document.addEventListener('DOMContentLoaded', async () => {
    // Tampilkan loading spinner
    showLoadingSpinner();
    
    try {
        // --- 1. DATA LOADING ---
        const [banjirData, genanganData, riauData] = await Promise.all([
            fetch('./public/data/banjir.json').then(res => {
                if (!res.ok) throw new Error('Gagal memuat data banjir');
                return res.json();
            }),
            fetch('./public/data/csvjson.json').then(res => {
                if (!res.ok) throw new Error('Gagal memuat data genangan');
                return res.json();
            }),
            fetch('./public/data/polygon_riau.json').then(res => {
                if (!res.ok) throw new Error('Gagal memuat data Riau');
                return res.json();
            })
        ]);

        // --- 2. METRIC CALCULATION ---
        const totalFloodPoints = banjirData.features.length;
        const totalWaterloggingPoints = genanganData.features.length;
        const totalVictims = banjirData.features.reduce((sum, feature) => sum + (feature.properties.Jumlah_Korban || 0), 0);

        const affectedDistrictsSet = new Set();
        banjirData.features.forEach(f => affectedDistrictsSet.add(f.properties.Nama_Pemetaan));
        genanganData.features.forEach(f => affectedDistrictsSet.add(f.properties.kecamatan));
        const affectedDistricts = affectedDistrictsSet.size;

        // --- 3. UPDATE METRIC CARDS ---
        updateMetricCard('totalFloodPoints', totalFloodPoints);
        updateMetricCard('totalWaterloggingPoints', totalWaterloggingPoints);
        updateMetricCard('totalVictims', totalVictims);
        updateMetricCard('affectedDistricts', affectedDistricts);

        // --- 4. CHART GENERATION ---
        // Bar Chart: Korban per Lokasi
        const victimsByLocation = {};
        banjirData.features.forEach(feature => {
            const location = feature.properties.Nama_Pemetaan;
            victimsByLocation[location] = (victimsByLocation[location] || 0) + (feature.properties.Jumlah_Korban || 0);
        });

        const victimsCtx = document.getElementById('victimsChart').getContext('2d');
        new Chart(victimsCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(victimsByLocation),
                datasets: [{
                    label: 'Jumlah Korban',
                    data: Object.values(victimsByLocation),
                    backgroundColor: 'rgba(56, 189, 248, 0.5)',
                    borderColor: 'rgba(56, 189, 248, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        }
                    }
                }
            }
        });

        // Pie Chart: Klasifikasi Area
        const classificationCount = {};
        riauData.features.forEach(feature => {
            const classification = feature.properties.KLASIFIKAS;
            classificationCount[classification] = (classificationCount[classification] || 0) + 1;
        });

        const classificationCtx = document.getElementById('classificationChart').getContext('2d');
        new Chart(classificationCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(classificationCount),
                datasets: [{
                    data: Object.values(classificationCount),
                    backgroundColor: [
                        '#38bdf8', '#10b981', '#06b6d4', '#f59e0b', '#f43f5e', '#818cf8'
                    ],
                    hoverBackgroundColor: ['#0ea5e9', '#059669', '#0891b2', '#d97706', '#e11d48', '#6366f1'],
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            padding: 20
                        }
                    }
                }
            }
        });

        // --- 5. DATA TABLE POPULATION ---
        const tableBody = document.getElementById('dataTableBody');
        const searchInput = document.getElementById('tableSearch');
        const filterBtn = document.querySelector('.ri-filter-3-line').parentElement;
        const sortBtn = document.querySelector('.ri-sort-asc').parentElement;
        
        let currentSortField = 'location';
        let sortDirection = 'asc';
        let allPointData = [...banjirData.features, ...genanganData.features];
        let filteredData = [...allPointData];

        // Fungsi untuk populate tabel
        const populateTable = (data, page = 1) => {
            const itemsPerPage = 10;
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedData = data.slice(startIndex, endIndex);
            
            tableBody.innerHTML = '';
            paginatedData.forEach((feature, index) => {
                const row = document.createElement('tr');
                const props = feature.properties;
                const type = props.Nama_Pemetaan ? 'Banjir' : 'Genangan';
                const location = props.Nama_Pemetaan || props.jalan || '-';
                const district = props.kecamatan || '-';
                const victims = props.Jumlah_Korban || '-';
                const featureIndex = allPointData.indexOf(feature);

                row.innerHTML = `
                    <td>${type}</td>
                    <td>${location}</td>
                    <td>${district}</td>
                    <td>${victims}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-btn" data-index="${featureIndex}">
                            <i class="ri-eye-line"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info map-btn" data-index="${featureIndex}">
                            <i class="ri-map-pin-line"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Update pagination
            updatePagination(data.length, page, itemsPerPage);
            
            // Add event listeners to action buttons
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = this.getAttribute('data-index');
                    showFeatureDetails(allPointData[index]);
                });
            });
            
            document.querySelectorAll('.map-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const index = this.getAttribute('data-index');
                    showFeatureOnMap(allPointData[index]);
                });
            });
        };

        // Fungsi untuk update pagination
        const updatePagination = (totalItems, currentPage, itemsPerPage) => {
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const pagination = document.querySelector('.pagination');
            pagination.innerHTML = '';
            
            // Previous button
            const prevLi = document.createElement('li');
            prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
            prevLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>`;
            pagination.appendChild(prevLi);
            
            // Page numbers
            for (let i = 1; i <= totalPages; i++) {
                const li = document.createElement('li');
                li.className = `page-item ${i === currentPage ? 'active' : ''}`;
                li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
                pagination.appendChild(li);
            }
            
            // Next button
            const nextLi = document.createElement('li');
            nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
            nextLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>`;
            pagination.appendChild(nextLi);
            
            // Add event listeners to pagination links
            document.querySelectorAll('.page-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const page = parseInt(this.getAttribute('data-page'));
                    if (page > 0 && page <= totalPages) {
                        populateTable(filteredData, page);
                    }
                });
            });
        };

        // Fungsi untuk sorting data
        const sortData = (field) => {
            if (currentSortField === field) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortField = field;
                sortDirection = 'asc';
            }
            
            filteredData.sort((a, b) => {
                let aVal, bVal;
                
                switch(field) {
                    case 'type':
                        aVal = a.properties.Nama_Pemetaan ? 'Banjir' : 'Genangan';
                        bVal = b.properties.Nama_Pemetaan ? 'Banjir' : 'Genangan';
                        break;
                    case 'location':
                        aVal = a.properties.Nama_Pemetaan || a.properties.jalan || '';
                        bVal = b.properties.Nama_Pemetaan || b.properties.jalan || '';
                        break;
                    case 'district':
                        aVal = a.properties.kecamatan || '';
                        bVal = b.properties.kecamatan || '';
                        break;
                    case 'victims':
                        aVal = a.properties.Jumlah_Korban || 0;
                        bVal = b.properties.Jumlah_Korban || 0;
                        break;
                    default:
                        return 0;
                }
                
                if (typeof aVal === 'string') {
                    return sortDirection === 'asc' 
                        ? aVal.localeCompare(bVal) 
                        : bVal.localeCompare(aVal);
                } else {
                    return sortDirection === 'asc' 
                        ? aVal - bVal 
                        : bVal - aVal;
                }
            });
            
            // Update sort button icon
            sortBtn.innerHTML = sortDirection === 'asc' 
                ? '<i class="ri-sort-asc"></i>' 
                : '<i class="ri-sort-desc"></i>';
                
            populateTable(filteredData, 1);
        };

        // Event listener untuk search
        searchInput.addEventListener('keyup', () => {
            const searchTerm = searchInput.value.toLowerCase();
            filteredData = allPointData.filter(feature => {
                const props = feature.properties;
                const location = (props.Nama_Pemetaan || props.jalan || '').toLowerCase();
                const district = (props.kecamatan || '').toLowerCase();
                return location.includes(searchTerm) || district.includes(searchTerm);
            });
            populateTable(filteredData, 1);
        });

        // Event listener untuk sort button
        sortBtn.addEventListener('click', () => {
            // Create a simple dropdown for sort options
            if (!document.getElementById('sortDropdown')) {
                const dropdown = document.createElement('div');
                dropdown.id = 'sortDropdown';
                dropdown.className = 'dropdown-menu show';
                dropdown.style.position = 'absolute';
                dropdown.style.right = '0';
                dropdown.style.top = '100%';
                dropdown.innerHTML = `
                    <a class="dropdown-item" href="#" data-sort="type">Tipe</a>
                    <a class="dropdown-item" href="#" data-sort="location">Lokasi</a>
                    <a class="dropdown-item" href="#" data-sort="district">Kecamatan</a>
                    <a class="dropdown-item" href="#" data-sort="victims">Jumlah Korban</a>
                `;
                sortBtn.parentElement.appendChild(dropdown);
                
                // Add event listeners to sort options
                dropdown.querySelectorAll('.dropdown-item').forEach(item => {
                    item.addEventListener('click', function(e) {
                        e.preventDefault();
                        const field = this.getAttribute('data-sort');
                        sortData(field);
                        dropdown.remove();
                    });
                });
            } else {
                document.getElementById('sortDropdown').remove();
            }
        });

        // Event listener untuk filter button
        filterBtn.addEventListener('click', () => {
            // Create a simple filter modal
            if (!document.getElementById('filterModal')) {
                const modal = document.createElement('div');
                modal.id = 'filterModal';
                modal.className = 'modal fade show';
                modal.style.display = 'block';
                modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
                modal.innerHTML = `
                    <div class="modal-dialog">
                        <div class="modal-content bg-dark text-light">
                            <div class="modal-header">
                                <h5 class="modal-title">Filter Data</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Tipe</label>
                                    <select class="form-select bg-dark text-light" id="filterType">
                                        <option value="">Semua</option>
                                        <option value="banjir">Banjir</option>
                                        <option value="genangan">Genangan</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Kecamatan</label>
                                    <select class="form-select bg-dark text-light" id="filterDistrict">
                                        <option value="">Semua</option>
                                    </select>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" id="resetFilter">Reset</button>
                                <button type="button" class="btn btn-primary" id="applyFilter">Terapkan</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
                
                // Populate district dropdown
                const districts = new Set();
                allPointData.forEach(feature => {
                    const district = feature.properties.kecamatan;
                    if (district) districts.add(district);
                });
                
                const districtSelect = document.getElementById('filterDistrict');
                Array.from(districts).sort().forEach(district => {
                    const option = document.createElement('option');
                    option.value = district;
                    option.textContent = district;
                    districtSelect.appendChild(option);
                });
                
                // Event listeners
                document.querySelector('#filterModal .btn-close').addEventListener('click', () => {
                    modal.remove();
                });
                
                document.getElementById('resetFilter').addEventListener('click', () => {
                    document.getElementById('filterType').value = '';
                    document.getElementById('filterDistrict').value = '';
                    filteredData = [...allPointData];
                    populateTable(filteredData, 1);
                    modal.remove();
                });
                
                document.getElementById('applyFilter').addEventListener('click', () => {
                    const typeFilter = document.getElementById('filterType').value;
                    const districtFilter = document.getElementById('filterDistrict').value;
                    
                    filteredData = allPointData.filter(feature => {
                        const props = feature.properties;
                        const type = props.Nama_Pemetaan ? 'banjir' : 'genangan';
                        const district = props.kecamatan || '';
                        
                        return (!typeFilter || type === typeFilter) && 
                               (!districtFilter || district === districtFilter);
                    });
                    
                    populateTable(filteredData, 1);
                    modal.remove();
                });
            }
        });

        // Initialize table with all data
        populateTable(filteredData);

        // --- 6. MINI MAP INITIALIZATION ---
        initializeMiniMap(banjirData, genanganData);
        
        // --- 7. EVENT LISTENERS FOR EXPORT AND REFRESH ---
        document.querySelector('.ri-download-2-line').parentElement.addEventListener('click', exportData);
        document.querySelector('.ri-refresh-line').parentElement.addEventListener('click', refreshData);
        
        // Hide loading spinner
        hideLoadingSpinner();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showErrorNotification('Gagal memuat data dashboard. Silakan coba lagi.');
        hideLoadingSpinner();
    }
});

// --- HELPER FUNCTIONS ---

function showLoadingSpinner() {
    if (!document.getElementById('loadingSpinner')) {
        const spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.className = 'd-flex justify-content-center align-items-center position-fixed';
        spinner.style.top = '0';
        spinner.style.left = '0';
        spinner.style.width = '100%';
        spinner.style.height = '100%';
        spinner.style.backgroundColor = 'rgba(0,0,0,0.7)';
        spinner.style.zIndex = '9999';
        spinner.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        `;
        document.body.appendChild(spinner);
    }
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.remove();
}

function updateMetricCard(id, value) {
    const element = document.getElementById(id);
    if (element) {
        // Animate the counter
        const current = parseInt(element.textContent) || 0;
        const increment = (value - current) / 20;
        let step = 0;
        
        const timer = setInterval(() => {
            step++;
            const newValue = Math.round(current + increment * step);
            element.textContent = newValue;
            
            if (step >= 20) {
                element.textContent = value;
                clearInterval(timer);
            }
        }, 50);
    }
}

function showFeatureDetails(feature) {
    const props = feature.properties;
    const type = props.Nama_Pemetaan ? 'Banjir' : 'Genangan';
    const location = props.Nama_Pemetaan || props.jalan || '-';
    const district = props.kecamatan || '-';
    const victims = props.Jumlah_Korban || '-';
    const coordinates = feature.geometry.coordinates;
    
    // Create detail modal
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content bg-dark text-light">
                <div class="modal-header">
                    <h5 class="modal-title">Detail ${type}</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <label class="form-label">Tipe</label>
                        <p class="form-control-plaintext">${type}</p>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Lokasi</label>
                        <p class="form-control-plaintext">${location}</p>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Kecamatan</label>
                        <p class="form-control-plaintext">${district}</p>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Jumlah Korban</label>
                        <p class="form-control-plaintext">${victims}</p>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Koordinat</label>
                        <p class="form-control-plaintext">${coordinates ? `${coordinates[1]}, ${coordinates[0]}` : '-'}</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
                    <button type="button" class="btn btn-primary" id="showOnMap">Tampilkan di Peta</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Event listeners
    document.querySelector('#showOnMap').addEventListener('click', () => {
        showFeatureOnMap(feature);
        modal.remove();
    });
    
    document.querySelectorAll('.btn-close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });
}

function showFeatureOnMap(feature) {
    // Switch to map view
    window.location.href = 'index.html#feature=' + allPointData.indexOf(feature);
}

function initializeMiniMap(banjirData, genanganData) {
    // Check if ol is available
    if (typeof ol === 'undefined') {
        console.error('OpenLayers is not loaded');
        return;
    }
    
    // Create mini map
    const miniMap = new ol.Map({
        target: 'miniMap',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM({
                    url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                })
            }),
            new ol.layer.Vector({
                source: new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(banjirData, {
                        featureProjection: 'EPSG:3857'
                    })
                }),
                style: new ol.style.Style({
                    image: new ol.style.Icon({
                        anchor: [0.5, 1],
                        src: 'https://cdn-icons-png.flaticon.com/512/4470/4470326.png',
                        scale: 0.05
                    })
                })
            }),
            new ol.layer.Vector({
                source: new ol.source.Vector({
                    features: new ol.format.GeoJSON().readFeatures(genanganData, {
                        featureProjection: 'EPSG:3857'
                    })
                }),
                style: new ol.style.Style({
                    image: new ol.style.Icon({
                        anchor: [0.5, 1],
                        src: 'https://cdn-icons-png.flaticon.com/512/4151/4151021.png',
                        scale: 0.05
                    })
                })
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([101.438309, 0.510440]),
            zoom: 10
        }),
        controls: ol.control.defaults({
            attribution: false,
            zoom: false
        })
    });
    
    // Add interaction to show feature info on click
    miniMap.on('singleclick', function(evt) {
        const features = [];
        miniMap.forEachFeatureAtPixel(evt.pixel, function(feature) {
            features.push(feature);
        });
        
        if (features.length > 0) {
            const feature = features[0];
            const props = feature.getProperties();
            const type = props.Nama_Pemetaan ? 'Banjir' : 'Genangan';
            const location = props.Nama_Pemetaan || props.jalan || '-';
            const district = props.kecamatan || '-';
            const victims = props.Jumlah_Korban || '-';
            
            // Create popup
            const popup = document.createElement('div');
            popup.className = 'ol-popup';
            popup.innerHTML = `
                <a href="#" class="ol-popup-closer"></a>
                <div>
                    <h5>${type}</h5>
                    <p><strong>Lokasi:</strong> ${location}</p>
                    <p><strong>Kecamatan:</strong> ${district}</p>
                    <p><strong>Korban:</strong> ${victims}</p>
                </div>
            `;
            
            const overlay = new ol.Overlay({
                element: popup,
                autoPan: true,
                autoPanAnimation: {
                    duration: 250
                }
            });
            
            miniMap.addOverlay(overlay);
            overlay.setPosition(evt.coordinate);
            
            // Add close button functionality
            popup.querySelector('.ol-popup-closer').onclick = function() {
                miniMap.removeOverlay(overlay);
                return false;
            };
        }
    });
}

function exportData() {
    // Create export modal
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content bg-dark text-light">
                <div class="modal-header">
                    <h5 class="modal-title">Export Data</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Pilih format export:</p>
                    <div class="d-grid gap-2">
                        <button type="button" class="btn btn-outline-primary" id="exportJSON">Export sebagai JSON</button>
                        <button type="button" class="btn btn-outline-primary" id="exportCSV">Export sebagai CSV</button>
                        <button type="button" class="btn btn-outline-primary" id="exportGeoJSON">Export sebagai GeoJSON</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('exportJSON').addEventListener('click', () => {
        exportAsJSON();
        modal.remove();
    });
    
    document.getElementById('exportCSV').addEventListener('click', () => {
        exportAsCSV();
        modal.remove();
    });
    
    document.getElementById('exportGeoJSON').addEventListener('click', () => {
        exportAsGeoJSON();
        modal.remove();
    });
    
    document.querySelectorAll('.btn-close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });
}

function exportAsJSON() {
    // Get current filtered data
    const data = {
        banjir: banjirData,
        genangan: genanganData,
        riau: riauData
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'floodguard-data.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showSuccessNotification('Data berhasil diekspor sebagai JSON');
}

function exportAsCSV() {
    // Create CSV content
    let csvContent = "Tipe,Lokasi,Kecamatan,Jumlah Korban\n";
    
    allPointData.forEach(feature => {
        const props = feature.properties;
        const type = props.Nama_Pemetaan ? 'Banjir' : 'Genangan';
        const location = props.Nama_Pemetaan || props.jalan || '';
        const district = props.kecamatan || '';
        const victims = props.Jumlah_Korban || '';
        
        csvContent += `"${type}","${location}","${district}","${victims}"\n`;
    });
    
    const dataUri = 'data:text/csv;charset=utf-8,'+ encodeURIComponent(csvContent);
    
    const exportFileDefaultName = 'floodguard-data.csv';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showSuccessNotification('Data berhasil diekspor sebagai CSV');
}

function exportAsGeoJSON() {
    // Combine all features into one GeoJSON
    const combinedData = {
        type: "FeatureCollection",
        features: [...banjirData.features, ...genanganData.features]
    };
    
    const dataStr = JSON.stringify(combinedData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'floodguard-geojson.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showSuccessNotification('Data berhasil diekspor sebagai GeoJSON');
}

function refreshData() {
    showLoadingSpinner();
    
    // Reload the page to refresh all data
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

function showSuccessNotification(message) {
    showNotification(message, 'success');
}

function showErrorNotification(message) {
    showNotification(message, 'danger');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="me-2">
                ${type === 'success' 
                    ? '<i class="ri-checkbox-circle-fill"></i>' 
                    : '<i class="ri-error-warning-fill"></i>'}
            </div>
            <div>${message}</div>
            <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
    
    // Add close button functionality
    notification.querySelector('.btn-close').addEventListener('click', () => {
        notification.remove();
    });
}