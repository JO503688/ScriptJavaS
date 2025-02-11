import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

const orgName = 'Profuturo-Prestamos';
const githubToken = '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';
const perPage = 100;
let requestCount = 0;

async function fetchWithRateLimitCheck(url, options) {
    let response = await fetch(url, options);
    requestCount++;

    if (response.status === 403) {
        const rateLimitResponse = await fetch('https://api.github.com/rate_limit', {
            headers: {
                Authorization: `token ${githubToken}`
            }
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
        response = await fetch(url, options);
        requestCount++;
    }

    return response;
}

async function getRepositoryTopicsAndReadme(repo) {
    const [topicsResponse, readmeResponse] = await Promise.all([
        fetchWithRateLimitCheck(`https://api.github.com/repos/${orgName}/${repo.name}/topics`, {
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.mercy-preview+json'
            }
        }),
        fetchWithRateLimitCheck(`${repo.url}/readme`, {
            headers: {
                Authorization: `token ${githubToken}`
            }
        })
    ]);

    const topics = topicsResponse.ok ? (await topicsResponse.json()).names || [] : [];
    const readmeContent = readmeResponse.ok
        ? Buffer.from((await readmeResponse.json()).content, 'base64').toString('utf-8')
        : '';

    return { topics, readmeContent };
}

async function getRepositoriesInfo() {
    const csvFilePath = `repositories_${orgName}.csv`;
    const csvWriter = createObjectCsvWriter({
        path: csvFilePath,
        header: [
            { id: 'organization', title: 'Organización' },
            { id: 'name', title: 'Nombre del Repositorio' },
            { id: 'description', title: 'Descripción' },
            { id: 'readme_content', title: 'README' },
            { id: 'html_url', title: 'URL' },
            { id: 'created_at', title: 'Fecha de creación' },
            { id: 'updated_at', title: 'Última actualización' },
            { id: 'pushed_at', title: 'Fecha del último push' },
            { id: 'private', title: '¿Es privado?' },
            { id: 'visibility', title: 'Visibilidad' },
            { id: 'size', title: 'Tamaño (KB)' },
            { id: 'language', title: 'Lenguaje principal' },
            { id: 'has_issues', title: 'Tiene issues' },
            { id: 'has_projects', title: 'Tiene proyectos' },
            { id: 'has_downloads', title: 'Tiene descargas' },
            { id: 'has_wiki', title: 'Tiene wiki' },
            { id: 'has_pages', title: 'Tiene páginas' },
            { id: 'archived', title: 'Archivado' },
            { id: 'disabled', title: 'Deshabilitado' },
            { id: 'open_issues_count', title: 'Cantidad de issues abiertos' },
            { id: 'default_branch', title: 'Rama predeterminada' },
            { id: 'topics', title: 'Temas' },
        ]
    });

    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
        const apiUrl = `https://api.github.com/orgs/${orgName}/repos?page=${page}&per_page=${perPage}`;

        try {
            const response = await fetchWithRateLimitCheck(apiUrl, {
                headers: {
                    Authorization: `token ${githubToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Error al obtener los repositorios. Código de estado: ${response.status}`);
            }

            const repositories = await response.json();

            if (repositories.length === 0) {
                hasNextPage = false;
            } else {
                for (const repo of repositories) {
                    const { topics, readmeContent } = await getRepositoryTopicsAndReadme(repo);
                    const repoData = {
                        organization: orgName,
                        name: repo.name,
                        description: repo.description || '',
                        readme_content: readmeContent,
                        html_url: repo.html_url,
                        created_at: repo.created_at,
                        updated_at: repo.updated_at,
                        pushed_at: repo.pushed_at,
                        private: repo.private,
                        visibility: repo.visibility,
                        size: repo.size,
                        language: repo.language || '',
                        has_issues: repo.has_issues,
                        has_projects: repo.has_projects,
                        has_downloads: repo.has_downloads,
                        has_wiki: repo.has_wiki,
                        has_pages: repo.has_pages,
                        archived: repo.archived,
                        disabled: repo.disabled,
                        open_issues_count: repo.open_issues_count,
                        default_branch: repo.default_branch,
                        topics: topics.join(', ')
                    };
                    await csvWriter.writeRecords([repoData]);
                }
                console.log(`Página ${page} de repositorios guardada en ${csvFilePath}`);
                page++;
            }
        } catch (error) {
            console.error('Ocurrió un error:', error.message);
            hasNextPage = false;
        }
    }

    console.log(`Todos los datos se han guardado correctamente en ${csvFilePath}`);
    console.log(`Número total de peticiones a GitHub: ${requestCount}`);
}

getRepositoriesInfo();
