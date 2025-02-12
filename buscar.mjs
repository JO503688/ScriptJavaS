import { writeFile } from "fs/promises";
import fetch from "node-fetch";

// Obtener el token desde las variables de entorno
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
    console.error("Error: TOKEN no está definido.");
    process.exit(1);
}

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

        console.log("Repositorios donde se encontró la coincidencia:", resultados);

        // Guardar resultados en un archivo CSV
        const csvContent = "Repositorio\n" + resultados.join("\n");
        await writeFile("resultados.csv", csvContent);
        console.log("Resultados guardados en resultados.csv");
    } catch (error) {
        console.error("Error en la búsqueda:", error.message);
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Uso: node buscar.mjs <organizacion> <query>");
    process.exit(1);
}

const [organizacion, query] = args;
buscarEnRepos(organizacion, query);
