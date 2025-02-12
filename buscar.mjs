import fetch from "node-fetch";

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error("Error: TOKEN no está definido.");
    process.exit(1);
}

// Función para buscar en los repositorios
async function buscarEnRepos(organizacion, query) {
    const url = `https://api.github.com/orgs/${organizacion}/repos`;
    const headers = { 
        "Authorization": `Bearer ${TOKEN}`,
        "Accept": "application/vnd.github.v3+json"
    };

    try {
        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const repos = await response.json();
        const resultados = [];

        for (const repo of repos) {
            const contenidoUrl = `https://api.github.com/repos/${organizacion}/${repo.name}/contents`;
            const contenidoResponse = await fetch(contenidoUrl, { headers });

            if (!contenidoResponse.ok) continue;

            const archivos = await contenidoResponse.json();
            if (archivos.some(archivo => archivo.name.includes(query))) {
                resultados.push(repo.name);
            }
        }

        // ✅ Enviar resultado en formato JSON
        console.log(JSON.stringify({ encontrados: resultados }, null, 2));
    } catch (error) {
        console.error(JSON.stringify({ error: error.message }, null, 2));
    }
}

// Recibir argumentos desde el frontend o GitHub Actions
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error(JSON.stringify({ error: "Uso: node buscar.mjs <organizacion> <query>" }, null, 2));
    process.exit(1);
}

const [organizacion, query] = args;
buscarEnRepos(organizacion, query);
