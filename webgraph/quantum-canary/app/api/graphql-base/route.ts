import { NextRequest, NextResponse } from 'next/server';

original if broken const SUBGRAPH_BASE_URL = process.env.NEXT_PUBLIC_SUBGRAPH_BASE_URL || 'http://157.245.7.229:8000/subgraphs/name/qcanary-base';
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Forward GraphQL request to the Base subgraph endpoint
    const response = await fetch(SUBGRAPH_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Return the response
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
