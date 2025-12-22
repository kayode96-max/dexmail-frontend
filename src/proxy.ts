import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500, // Max 500 users per second
});

export async function proxy(request: NextRequest) {
    const response = NextResponse.next();

    // specific logic for API routes
    if (request.nextUrl.pathname.startsWith('/api')) {
        // Rate Limiting
        const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
        const { isRateLimited, limit, remaining } = await limiter.check(20, ip); // 20 requests per minute

        if (isRateLimited) {
            return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': '0',
                },
            });
        }

        response.headers.set('X-RateLimit-Limit', limit.toString());
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
    }

    // Security Headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Content-Security-Policy', "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';");

    return response;
}

export const config = {
    matcher: [
        '/api/:path*',
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
