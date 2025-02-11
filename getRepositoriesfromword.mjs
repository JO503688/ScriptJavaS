import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Cargar el token desde las variables de entorno (archivo .env)
const githubToken = process.env.TOKEN;
const orgName = process.argv[2];  // Recibe el nombre de la organización desde GitHub Actions
const searchQuery = process.argv[3];  // Recibe el término de búsqueda desde GitHub Actions

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

    // Mostrar los resultados en consola
    console.log('Repositorios encontrados:', foundRepos);
}

searchInRepositories();
