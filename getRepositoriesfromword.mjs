import express from 'express';
import fetch from 'node-fetch';   // Para hacer las solicitudes a la API de GitHub
import dotenv from 'dotenv';     // Para manejar las variables de entorno

dotenv.config();  // Cargar las variables de entorno, asegurate de que GITHUB_TOKEN esté en el archivo .env

const app = express();
const port = process.env.PORT || 3000;

// Usamos un token de GitHub guardado como variable de entorno
const githubToken = process.env.TOKEN;  // Asegúrate de que el token esté en el archivo .env

// Habilitar para recibir JSON
app.use(express.json());
app.use(express.static('public'));  // Directorio donde está tu archivo HTML

// Función para hacer las búsquedas en los repositorios
async function fetchWithRateLimitCheck(url) {
    let response = await fetch(url, {
        headers: { Authorization: `token ${githubToken}` }
    });

    if (response.status === 403) {
        const rateLimitResponse = await fetch('https://api.github.com/rate_limit', {
            headers: { Authorization: `token ${githubToken}` }
        });
        const rateLimitData = await rateLimitResponse.json();
        const resetTime = rateLimitData.rate.reset;
        const currentTime = Math.floor(Date.now() / 1000);
        const waitTime = resetTime - currentTime;
        if (waitTime > 0) {
            console.log(`Límite de tasa alcanzado. Esperando ${waitTime} segundos...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
        response = await fetch(url, { headers: { Authorization: `token ${githubToken}` } });
    }
    return response;
}

// Endpoint que maneja la búsqueda
app.post('/buscar', async (req, res) => {
    const { org, query } = req.body;

    if (!org || !query) {
        return res.status(400).json({ error: 'Faltan parámetros de organización o término de búsqueda.' });
    }

    const perPage = 100;
    let page = 1;
    let hasNextPage = true;
    const foundRepos = [];

    while (hasNextPage) {
        const apiUrl = `https://api.github.com/search/code?q=${encodeURIComponent(query)}+org:${org}&per_page=${perPage}&page=${page}`;
        
        try {
            const response = await fetchWithRateLimitCheck(apiUrl);
            const result = await response.json();
            
            if (result.items.length === 0) {
                hasNextPage = false;
            } else {
                result.items.forEach(item => foundRepos.push(item.repository.full_name));
                page++;
            }
        } catch (error) {
            console.error('Error al buscar en los repositorios:', error.message);
            hasNextPage = false;
        }
    }

    // Enviar la respuesta con los repositorios encontrados
    res.json(foundRepos);
});

// Iniciar el servidor en el puerto especificado
app.listen(port, () => {
    console.log(`Servidor backend escuchando en http://localhost:${port}`);
});
