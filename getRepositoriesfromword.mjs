import fetch from 'node-fetch';
import { createObjectCsvWriter } from 'csv-writer';

const orgName = 'Profuturo-Prestamos';
const githubToken = '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';
const searchQuery = 'jdbc/clienteUnico'; // Texto a buscar
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
    const foundRepos = new Set();
    
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
                result.items.forEach(item => foundRepos.add(item.repository.full_name));
                page++;
            }
        } catch (error) {
            console.error('Ocurrió un error:', error.message);
            hasNextPage = false;
        }
    }

    const csvWriter = createObjectCsvWriter({
        path: `search_results_${orgName}.csv`,
        header: [{ id: 'repository', title: 'Repositorio' }]
    });
    await csvWriter.writeRecords([...foundRepos].map(repo => ({ repository: repo })));
    
    console.log(`Búsqueda completada. Resultados guardados en search_results_${orgName}.csv`);
    console.log(`Número total de peticiones a GitHub: ${requestCount}`);
}

searchInRepositories();