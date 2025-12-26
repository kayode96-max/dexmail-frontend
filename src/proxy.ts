import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, generateFingerprint } from '@/lib/rate-limit';

const limiter = rateLimit({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500, // Max 500 unique clients tracked
    // Botnet protection
    enableFingerprinting: true,
    enableExponentialBackoff: true,
    enableGlobalLimit: true,
    globalLimit: 5000, // Max 5000 requests per minute globally
    maxViolations: 5, // Ban after 5 violations
    banDuration: 15 * 60 * 1000, // 15 minute ban
});

export async function proxy(request: NextRequest) {
    const response = NextResponse.next();

    if (request.nextUrl.pathname.startsWith('/api')) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
            ?? request.headers.get('x-real-ip') 
            ?? '127.0.0.1';
        
        const fingerprint = generateFingerprint({
            userAgent: request.headers.get('user-agent'),
            acceptLanguage: request.headers.get('accept-language'),
            acceptEncoding: request.headers.get('accept-encoding'),
            accept: request.headers.get('accept'),
            connection: request.headers.get('connection'),
            cacheControl: request.headers.get('cache-control'),
        });

        const { 
            isRateLimited, 
            limit, 
            remaining, 
            isBanned, 
            banExpiresIn, 
            suspicionScore,
            reason 
        } = await limiter.check(20, ip, fingerprint);

        response.headers.set('X-RateLimit-Limit', limit.toString());
        response.headers.set('X-RateLimit-Remaining', remaining.toString());

        if (isBanned) {
            const retryAfter = Math.ceil((banExpiresIn || 900000) / 1000);
            return new NextResponse(JSON.stringify({ 
                error: 'Access Temporarily Blocked',
                reason: 'Too many violations detected',
                retryAfter,
            }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': '0',
                    'Retry-After': retryAfter.toString(),
                },
            });
        }

        if (isRateLimited) {
            if (suspicionScore > 50) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            return new NextResponse(JSON.stringify({ 
                error: 'Too Many Requests',
                retryAfter: 60,
            }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': '0',
                    'Retry-After': '60',
                },
            });
        }

        if (suspicionScore > 25) {
            response.headers.set('X-Suspicion-Level', suspicionScore > 50 ? 'high' : 'medium');
        }
    }

    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
        'Content-Security-Policy',
        [
            "default-src 'self' https: http: data: 'unsafe-inline' 'unsafe-eval'",
            "img-src 'self' https: http: data: blob:",
            "connect-src 'self' https: http: wss: ws:",
            "font-src 'self' https: http: data:",
            "frame-src 'self' https: http:",
        ].join('; ')
    );

    return response;
}

export const config = {
    matcher: [
        '/api/:path*',
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
