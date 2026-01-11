document.addEventListener('DOMContentLoaded', async () => {
  const newsContainer = document.getElementById('news-container');
  const loadingSpinner = newsContainer.querySelector('.loading-spinner');

  try {
    // Fetch data dari file JSON
    const response = await fetch('/data/news.json');
    if (!response.ok) {
      throw new Error('Gagal memuat data berita');
    }
    const newsData = await response.json();

    // Sembunyikan loading spinner
    if (loadingSpinner) {
      loadingSpinner.style.display = 'none';
    }

    // Kosongkan container
    newsContainer.innerHTML = '';

    // Buat grid untuk kartu berita
    const newsGrid = document.createElement('div');
    newsGrid.className = 'row g-4';

    // Loop melalui data dan buat kartu untuk setiap berita
    newsData.forEach(article => {
      const newsCard = document.createElement('div');
      newsCard.className = 'col-lg-4 col-md-6';

      const categoryClass = article.category === 'Berita' ? 'category-news' : 
                            article.category === 'Analisis Data' ? 'category-analysis' : 
                            'category-update';

      newsCard.innerHTML = `
        <div class="news-card h-100">
          <img src="${article.imageUrl}" class="card-img-top" alt="${article.title}">
          <div class="card-body">
            <span class="badge ${categoryClass}">${article.category}</span>
            <h5 class="card-title mt-2">${article.title}</h5>
            <p class="card-text text-muted">${article.excerpt}</p>
            <div class="d-flex justify-content-between align-items-center mt-auto">
              <small class="text-muted">${new Date(article.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</small>
              <a href="#" class="btn btn-sm btn-outline-light read-more-btn" data-id="${article.id}">Baca Selengkapnya</a>
            </div>
          </div>
        </div>
      `;
      newsGrid.appendChild(newsCard);
    });

    newsContainer.appendChild(newsGrid);

    // Tambahkan animasi GSAP ScrollTrigger untuk kartu berita
    gsap.utils.toArray('.news-card').forEach((card, i) => {
      gsap.from(card, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        delay: i * 0.1,
        scrollTrigger: {
          trigger: card,
          start: 'top 85%'
        }
      });
    });

    // Event listener untuk tombol "Baca Selengkapnya"
    document.querySelectorAll('.read-more-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const articleId = e.target.getAttribute('data-id');
        alert(`Anda mengklik artikel dengan ID: ${articleId}. Halaman detail belum tersedia.`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
    if (loadingSpinner) {
      loadingSpinner.innerHTML = '<p class="text-danger">Gagal memuat data. Silakan coba lagi nanti.</p>';
    }
  }
});