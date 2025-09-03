export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { message, systemPrompt } = req.body;

        // Set a timeout for the Claude API call
        const claudePromise = fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-beta': 'messages-2023-12-15'
            },
            body: JSON.stringify({
                model: 'claude-3-opus-20240229',
                messages: [{
                    role: 'user',
                    content: message
                }],
                system: systemPrompt,
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        // Add timeout to Claude request - increased to 45 seconds
        const claudeResponse = await Promise.race([
            claudePromise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Claude API timeout')), 45000)
            )
        ]);

        if (!claudeResponse.ok) {
            throw new Error(await claudeResponse.text());
        }

        const claudeData = await claudeResponse.json();
        const fullText = claudeData.content[0].text;
        
        // Extract text without codeblocks for voice
        const textToSpeak = fullText.split(/```[\s\S]*?```/).join(' ').trim();

        // Only generate voice if there's text to speak
        if (textToSpeak) {
            try {
                // Use your custom voice ID
                const VOICE_ID = 'jBpfuIE2acCO8z3wKNLl';
                
                // Set a timeout for the ElevenLabs API call
                const voicePromise = fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': process.env.ELEVENLABS_API_KEY
                    },
                    body: JSON.stringify({
                        text: textToSpeak,
                        model_id: 'eleven_monolingual_v1',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                            style: 0.66,
                            use_speaker_boost: true
                        }
                    })
                });

                // Add timeout to ElevenLabs request
                const voiceResponse = await Promise.race([
                    voicePromise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('ElevenLabs API timeout')), 15000)
                    )
                ]);

                if (!voiceResponse.ok) {
                    // If voice generation fails, return text-only response
                    console.error('Voice generation failed, returning text-only response');
                    return res.status(200).json(claudeData);
                }

                const audioBuffer = await voiceResponse.arrayBuffer();
                const audioBase64 = Buffer.from(audioBuffer).toString('base64');

                return res.status(200).json({
                    ...claudeData,
                    audio: audioBase64
                });
            } catch (voiceError) {
                // If voice generation times out or fails, return text-only response
                console.error('Voice generation error:', voiceError);
                return res.status(200).json(claudeData);
            }
        }

        // Return text-only response if no text to speak
        return res.status(200).json(claudeData);
    } catch (error) {
        console.error('Server error:', error);
        
        // Return a proper JSON response even for timeouts
        res.status(error.message.includes('timeout') ? 504 : 500).json({
            error: error.message,
            type: error.message.includes('timeout') ? 'timeout' : 'server_error'
        });
    }
}