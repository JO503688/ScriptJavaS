import fetch from 'node-fetch';

// Aquí pasas directamente el token de GitHub
const githubToken = process.env.GITHUB_TOKEN;  // Reemplaza con tu token de GitHub

const orgName = process.argv[2];  // Recibe el nombre de la organización desde el frontend
const searchQuery = process.argv[3];  // Recibe la palabra de búsqueda desde el frontend

// Comprobar si los parámetros son válidos
if (!orgName || !searchQuery) {
    console.error("Se requiere una organización y un término de búsqueda.");
    process.exit(1);  // Salir si no se proporcionan los datos
}

const perPage = 100;
let requestCount = 0;

async function fetchWithRateLimitCheck(url) {
    let response = await fetch(url, {
        headers: { Authorization: `token ${githubToken}` }
    });
    requestCount++;

    if (response.status === 403) {
        const rateLimitResponse = await fetch('https://api.github.com/rate_limit', {
            headers: { Authorization: `token ${githubToken}` }
        });
        requestCount++;
        const rateLimitData = await rateLimitResponse.json();
        const resetTime = rateLimitData.rate.reset;
        const currentTime = Math.floor(Date.now() / 1000);
        const waitTime = resetTime - currentTime;
        if (waitTime > 0) {
            console.log(`Límite de tasa alcanzado. Esperando ${waitTime} segundos para reanudar...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
        response = await fetch(url, { headers: { Authorization: `token ${githubToken}` } });
        requestCount++;
    }
    return response;
}

async function searchInRepositories() {
    let page = 1;
    let hasNextPage = true;
    const foundRepos = [];
    
    while (hasNextPage) {
        const apiUrl = `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}+org:${orgName}&per_page=${perPage}&page=${page}`;
        try {
            const response = await fetchWithRateLimitCheck(apiUrl);
            if (!response.ok) {
                throw new Error(`Error en la búsqueda. Código de estado: ${response.status}`);
            }
            const result = await response.json();
            
            if (result.items.length === 0) {
                hasNextPage = false;
            } else {
                result.items.forEach(item => foundRepos.push(item.repository.full_name));
                page++;
            }
        } catch (error) {
            console.error('Ocurrió un error:', error.message);
            hasNextPage = false;
        }
    }

    // Mostrar los resultados en el frontend
    displayResults(foundRepos);
}

function displayResults(repositories) {
    const resultsContainer = document.getElementById("resultados"); // El contenedor donde mostrar los resultados

    // Limpiar resultados previos
    resultsContainer.innerHTML = '';

    if (repositories.length > 0) {
        const ul = document.createElement('ul');
        repositories.forEach(repo => {
            const li = document.createElement('li');
            li.textContent = repo;  // Mostrar el nombre completo del repositorio
            ul.appendChild(li);
        });
        resultsContainer.appendChild(ul);
    } else {
        resultsContainer.textContent = "No se encontraron resultados para la búsqueda.";
    }
}

// Llamar a la función de búsqueda
searchInRepositories();
