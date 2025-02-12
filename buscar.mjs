import { writeFile } from "fs/promises";
import fetch from "node-fetch";

const GITHUB_TOKEN = process.env.TOKEN;

async function buscarEnRepos(org, query) {
    const url = `https://api.github.com/search/code?q=${query}+org:${org}`;
    const headers = { "Authorization": `token ${TOKEN}` };
    
    const response = await fetch(url, { headers });
    if (!response.ok) {
        console.error("Error en la búsqueda:", response.status);
        return { error: "No se pudo realizar la búsqueda" };
    }
    
    const data = await response.json();
    return data.items ? data.items.map(item => item.repository.full_name) : [];
}

async function main() {
    const org = process.argv[2];
    const query = process.argv[3];

    console.log(`🔍 Buscando "${query}" en la organización "${org}"...`);

    const resultados = await buscarEnRepos(org, query);
    
    await writeFile("resultados.json", JSON.stringify(resultados, null, 2));
    console.log("✅ Resultados guardados en resultados.json");
}

main();
