import { NextRequest, NextResponse } from 'next/server';

const PINATA_API_URL = 'https://api.pinata.cloud';

export async function POST(req: NextRequest) {
    try {
        const jwt = process.env.PINATA_JWT;
        if (!jwt) {
            return NextResponse.json(
                { error: 'PINATA_JWT is not configured' },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File size exceeds 10MB limit' },
                { status: 400 }
            );
        }

        // Prepare form data for Pinata
        const pinataFormData = new FormData();
        pinataFormData.append('file', file);
        pinataFormData.append('pinataMetadata', JSON.stringify({
            name: `attachment-${Date.now()}-${file.name}`,
        }));
        pinataFormData.append('pinataOptions', JSON.stringify({
            cidVersion: 1,
        }));

        // Upload to Pinata
        const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${jwt}`,
            },
            body: pinataFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Pinata upload error:', errorText);
            return NextResponse.json(
                { error: 'Failed to upload to IPFS' },
                { status: 500 }
            );
        }

        const result = await response.json();

        return NextResponse.json({
            success: true,
            cid: result.IpfsHash,
            name: file.name,
            size: file.size,
            type: file.type,
            timestamp: result.Timestamp,
        });
    } catch (error) {
        console.error('IPFS file upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}

// Route segment config for App Router
// FormData is handled natively, no special config needed
export const dynamic = 'force-dynamic';
