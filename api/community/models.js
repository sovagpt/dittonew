const { MongoClient } = require('mongodb');

let cachedDb = null;
let cachedClient = null;

async function connectToDatabase(uri) {
    if (cachedDb && cachedClient) {
        return cachedDb;
    }
    
    const client = new MongoClient(uri, {
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    // Remove this line: bufferMaxEntries: 0,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames: false,
});
    
    cachedClient = await client.connect();
    const db = cachedClient.db('dittoai');
    cachedDb = db;
    return db;
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

