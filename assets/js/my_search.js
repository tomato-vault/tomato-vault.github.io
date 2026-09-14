document.addEventListener("DOMContentLoaded", function() {
    var searchButton = document.getElementById('_search');
    var searchBox = document.getElementById('_search-box');
    var resetButton = document.getElementById('reset-btn');
    var searchInput = document.getElementById('_search-input');
    var hitsContainer = document.getElementById('_hits');
    var searchResults = document.getElementById('search-results');
    var posts = [];

    fetch('/posts.json')
        .then(response => response.json())
        .then(data => {
            posts = data;
        })
        .catch(error => console.error('Error loading posts:', error));

    searchButton.addEventListener('click', function() {
        if (searchBox.classList.contains('show')) {
            searchBox.classList.remove('show');
            hitsContainer.style.display = 'none';
        } else {
            searchBox.classList.add('show');
        }
    });

    resetButton.addEventListener('click', function() {
        searchBox.classList.remove('show');
        hitsContainer.style.display = 'none';
        searchResults.innerHTML = '';
        searchInput.value = '';
    });

    searchInput.addEventListener('input', function() {
        var query = searchInput.value.toLowerCase();
        console.log("QUERY", query);
        searchResults.innerHTML = '';

        if (query) {
            var filteredPosts = posts.filter(function(post) {
                return post.title.toLowerCase().includes(query);
            });

            if (filteredPosts.length > 0) {
                filteredPosts.forEach(function(post) {
                    var postImage = post.image ? post.image : '';

                    var li = document.createElement('li');
                    li.className = 'search-item';
                    li.innerHTML = `
                        <div class="search-img aspect-ratio sixteen-ten">
                            ${postImage ? `<img src="${postImage}" alt="${post.title}" />` : ''}
                        </div>
                        <div class="search-text">
                            <p>
                                <a class="heading" tabindex="1" href="${post.url}">${post.title}</a>
                                <small>${post.url}</small>
                            </p>
                        </div>
                    `;
                    li.addEventListener('click', function() {
                        searchBox.classList.remove('show');
                        hitsContainer.style.display = 'none';
                        searchResults.innerHTML = '';
                        searchInput.value = '';
                        window.location.href = post.url;
                    });
                    searchResults.appendChild(li);
                });
                hitsContainer.style.display = 'block';
            } else {
                hitsContainer.style.display = 'none';
            }
        } else {
            hitsContainer.style.display = 'none';
        }
    });
});
