const { MongoClient } = require('mongodb');

let cachedClient = null;

async function connectToDatabase(uri) {
    if (cachedClient) {
        return cachedClient.db();
    }
    
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
    return cachedClient.db();
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const db = await connectToDatabase(process.env.MONGODB_URI);
        const models = await db.collection('models')
            .find()
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
            
        res.status(200).json(models);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Database connection failed', details: error.message });
    }
};
