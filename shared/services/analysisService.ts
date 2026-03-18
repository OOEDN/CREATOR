
/**
 * Service to interact with Google Cloud Natural Language API
 */

const NLP_API_ENDPOINT = 'https://language.googleapis.com/v1/documents:analyzeSentiment';

export const analyzeSentiment = async (text: string, token: string) => {
    if (!text || text.length < 5) return null;

    const requestBody = {
        document: {
            type: 'PLAIN_TEXT',
            content: text
        },
        encodingType: 'UTF8'
    };

    try {
        const response = await fetch(NLP_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.json();
            // Silence permission errors to avoid UI clutter if API isn't enabled
            console.warn("NLP API Warning:", err);
            return null;
        }

        const data = await response.json();
        const score = data.documentSentiment?.score || 0;
        const magnitude = data.documentSentiment?.magnitude || 0;

        // Interpret result
        let label = 'Neutral';
        let color = 'text-neutral-500';

        if (score > 0.25) {
            label = 'Positive';
            color = 'text-emerald-500';
        } else if (score < -0.25) {
            label = 'Negative';
            color = 'text-red-500';
        }

        return { score, magnitude, label, color };
    } catch (e) {
        console.error("NLP Error", e);
        return null;
    }
};
