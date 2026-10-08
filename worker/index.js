// Serves the R2 bucket on askbudget.app. R2 has no index document, so "/" maps to index.html.
export default {
    async fetch(request, env) {
        if (request.method !== "GET" && request.method !== "HEAD") {
            return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
        }

        let key = decodeURIComponent(new URL(request.url).pathname.slice(1));
        if (key === "" || key.endsWith("/")) key += "index.html";

        const object = await env.BUCKET.get(key);
        if (!object) return new Response("Not found", { status: 404 });

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        return new Response(request.method === "HEAD" ? null : object.body, { headers });
    },
};
