const { MongoClient } = require('mongodb');

export default async function handler(req, res) {
    const communityHandler = require('./community').default;
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Handle community routes
    if (req.url.startsWith('/api/community')) {
        return communityHandler(req, res);
    }

    // Handle proxy requests
    if (req.url.startsWith('/api/proxy')) {
        const targetUrl = new URL(req.query.url);
        const response = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: {
                'Authorization': req.headers.authorization,
                'Content-Type': req.headers['content-type'],
            },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();
        return res.json(data);
    }

    // Handle chat requests
    if (req.url === '/api/chat') {
        try {
            const { message, systemPrompt } = req.body;

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-2.1',
                    max_tokens: 1000,
                    messages: [{
                        role: 'user',
                        content: message
                    }],
                    system: systemPrompt
                })
            });

            const data = await response.json();
            return res.json(data);
        } catch (error) {
            console.error('Chat API Error:', error);
            return res.status(500).json({ error: 'Chat request failed' });
        }
    }

    // If no route matched
    res.status(404).json({ error: 'Not found' });
}