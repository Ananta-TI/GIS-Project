// components/Navbar.js

function renderNavbar() {
    // 1. Definisikan HTML Navbar
    const navbarHTML = `
    <nav class="navbar navbar-expand-lg navbar-custom">
        <div class="container">
            <a class="navbar-brand text-white fw-bold d-flex align-items-center gap-2 brand-font" href="index.html">
                POSEIDON
            </a>
            <button class="navbar-toggler navbar-dark" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse justify-content-center" id="navbarNav">
                <ul class="navbar-nav gap-4">
                    <li class="nav-item"><a class="nav-link" href="index.html">Beranda</a></li>
                    <li class="nav-item"><a class="nav-link" href="map.html">Peta Live</a></li>
                    <li class="nav-item"><a class="nav-link" href="dashboard.html">Data Historis</a></li>
                    <li class="nav-item"><a class="nav-link" href="laporan.html">Laporan</a></li>
                </ul>
            </div>
            <div class="d-none d-lg-block">
                <a href="login.html" class="btn btn-gradient">Dashboard Admin</a>
            </div>
        </div>
    </nav>
    `;

    // 2. Suntikkan ke dalam elemen dengan ID 'navbar-root'
    const navRoot = document.getElementById('navbar-root');
    if (navRoot) {
        navRoot.innerHTML = navbarHTML;
        setActiveLink(); // Panggil fungsi highlight
    }
}

// 3. Fungsi Logika untuk Highlight Menu Aktif
function setActiveLink() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        // Ambil href dari link (misal: "map.html")
        const linkPath = link.getAttribute('href');
        
        if (linkPath === currentPath) {
            link.classList.add('active');
        }
    });
}

// Jalankan fungsi saat script dimuat
document.addEventListener("DOMContentLoaded", renderNavbar);