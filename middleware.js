/**
 * Host-based routing for admin.codeloot.codes.
 * Vercel serves /index.html before vercel.json rewrites on /, so middleware
 * rewrites the admin subdomain root to admin-index.html.
 */
const ADMIN_HOST = 'admin.codeloot.codes';

function adminHost(request) {
    const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
    return host === ADMIN_HOST;
}

function rewriteTo(path, request) {
    return new Response(null, {
        headers: {
            'x-middleware-rewrite': new URL(path, request.url).toString(),
        },
    });
}

export const config = {
    matcher: ['/', '/login', '/admin'],
};

export default function middleware(request) {
    if (!adminHost(request)) {
        return;
    }

    const { pathname } = new URL(request.url);

    if (pathname === '/login') {
        return rewriteTo('/login.html', request);
    }

    if (pathname === '/' || pathname === '/admin' || pathname === '/admin/') {
        return rewriteTo('/admin-index.html', request);
    }
}
