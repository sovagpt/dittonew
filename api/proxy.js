export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Start with headers from the original request
    const headers = { ...req.headers };
    delete headers.host; // Remove host header as it should not be forwarded
    delete headers.authorization; // Remove any client authorization header
    
    const fetchOptions = {
        method: req.method,
        headers: headers
    };

    // ALWAYS add the Meshy API key for Meshy API calls from environment variable
    if (url.includes('api.meshy.ai')) {
    fetchOptions.headers.authorization = `Bearer ${process.env.MESHY_API_KEY}`;
    console.log('ACTUAL API KEY BEING USED:', process.env.MESHY_API_KEY); // Add this debug line
}

    // Handle POST request body
    if (req.method === 'POST') {
        if (headers['content-type']?.includes('multipart/form-data')) {
            // For file uploads, pass through the raw body
            fetchOptions.body = req.body;
        } else {
            // For JSON requests, ensure proper content type
            fetchOptions.headers['content-type'] = 'application/json';
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }
    }

    try {
        console.log('Proxy request to:', url);
        console.log('Request method:', fetchOptions.method);
        console.log('Headers being sent:', {
            ...fetchOptions.headers,
            authorization: fetchOptions.headers.authorization ? 'Bearer [REDACTED]' : 'None'
        });

        const response = await fetch(url, fetchOptions);
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Proxy error response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText
            });
            return res.status(response.status).json({
                error: 'API request failed',
                status: response.status,
                message: errorText
            });
        }

        const contentType = response.headers.get('content-type');
        
        // Set the response content type
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }
        
        if (contentType?.includes('application/json')) {
            const data = await response.json();
            console.log('Successful JSON response received');
            res.json(data);
        } else {
            // Handle binary data (like GLB files)
            const buffer = await response.arrayBuffer();
            res.send(Buffer.from(buffer));
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Proxy request failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

