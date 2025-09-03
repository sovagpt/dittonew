const ElevenLabs = require('elevenlabs-node');

const voice = new ElevenLabs({
    apiKey: process.env.ELEVENLABS_API_KEY // Will use: sk_7b37cf7505be75e6ebda6162402712ce525850619ab92183
});

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID; // Will use: e5emiKAgojCavnScP8md
let activeConversation = null;

async function handleAudioStream(audioStream) {
    if (!activeConversation) return;
    try {
        // Using specific agent ID for transcription and response
        const response = await voice.transcribe(audioStream, {
            agentId: AGENT_ID,
            optimize_streaming_latency: 3
        });
        return response;
    } catch (error) {
        console.error('Error processing audio:', error);
        throw error;
    }
}

module.exports = async function (req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { action, audioData } = req.body;

        switch (action) {
            case 'start':
                try {
                    // Initialize conversation with specific agent
                    activeConversation = await voice.startAgentConversation(AGENT_ID);
                    return res.status(200).json({ 
                        status: 'started',
                        message: 'Voice conversation started successfully',
                        agentId: AGENT_ID
                    });
                } catch (error) {
                    console.error('Failed to start conversation:', error);
                    return res.status(500).json({ 
                        error: 'Failed to start conversation',
                        details: error.message 
                    });
                }

            case 'stop':
                if (activeConversation) {
                    try {
                        await voice.endAgentConversation(AGENT_ID);
                        activeConversation = null;
                    } catch (error) {
                        console.error('Error ending conversation:', error);
                    }
                }
                return res.status(200).json({ 
                    status: 'stopped',
                    message: 'Voice conversation stopped successfully' 
                });

            case 'speak':
                if (!audioData) {
                    return res.status(400).json({ error: 'No audio data provided' });
                }
                if (!activeConversation) {
                    return res.status(400).json({ error: 'No active conversation' });
                }
                
                const response = await handleAudioStream(audioData);
                
                // Process response and generate voice reply
                if (response.text) {
                    const voiceResponse = await voice.generateSpeech(response.text, {
                        agentId: AGENT_ID,
                        optimize_streaming_latency: 3
                    });
                    
                    return res.status(200).json({
                        text: response.text,
                        audio: voiceResponse,
                        message: response.text + ' ~'
                    });
                }
                return res.status(200).json(response);

            case 'status':
                return res.status(200).json({ 
                    status: activeConversation ? 'active' : 'inactive',
                    agentId: AGENT_ID 
                });

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('ElevenLabs error:', error);
        return res.status(500).json({ 
            error: 'Voice processing failed', 
            details: error.message 
        });
    }
};