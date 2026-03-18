
/**
 * Service to interact with Google Cloud Video Intelligence API
 * URL: https://videointelligence.googleapis.com/v1/videos:annotate
 */
import { getGcsReferenceFromUrl } from './googleCloudStorage';

const VIDEO_API_ENDPOINT = 'https://videointelligence.googleapis.com/v1/videos:annotate';

export const analyzeVideoWithIntelligence = async (
  videoUrl: string,
  accessToken: string,
  projectId?: string
): Promise<{ tags: string[], raw: any }> => {
  const gcsUri = getGcsReferenceFromUrl(videoUrl);

  // Video Intelligence REQUIRED gs:// URI
  if (!gcsUri) {
    throw new Error("Video must be synced to Cloud Storage before analysis. Please wait for sync to complete.");
  }

  try {
    // 1. Start Operation
    const requestBody = {
        inputUri: gcsUri,
        features: ["LABEL_DETECTION", "EXPLICIT_CONTENT_DETECTION", "SHOT_CHANGE_DETECTION"]
    };

    console.log(`Starting Video Intelligence Job for ${gcsUri}...`);

    const startResponse = await fetch(VIDEO_API_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...(projectId ? { 'X-Goog-User-Project': projectId } : {})
        },
        body: JSON.stringify(requestBody)
    });

    if (!startResponse.ok) {
        const err = await startResponse.json();
        throw new Error(err.error?.message || "Failed to start Video Intelligence job");
    }

    const operation = await startResponse.json();
    const operationName = operation.name; // e.g. "projects/.../locations/.../operations/..."

    // 2. Poll for Completion
    // Video processing takes time. We will poll every 2 seconds.
    let isDone = false;
    let result = null;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes timeout

    while (!isDone && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;

        const pollUrl = `https://videointelligence.googleapis.com/v1/${operationName}`;
        const pollResponse = await fetch(pollUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                ...(projectId ? { 'X-Goog-User-Project': projectId } : {})
            }
        });

        if (!pollResponse.ok) throw new Error("Polling failed");
        
        const status = await pollResponse.json();
        if (status.done) {
            isDone = true;
            if (status.error) throw new Error(status.error.message);
            result = status.response;
        }
    }

    if (!result) throw new Error("Video Analysis timed out.");

    // 3. Process Results
    // Video Intelligence returns labels per segment or shot. We aggregate unique labels.
    const segmentLabels = result.annotationResults?.[0]?.segmentLabelAnnotations || [];
    const shotLabels = result.annotationResults?.[0]?.shotLabelAnnotations || [];
    
    const tags = new Set<string>();
    
    segmentLabels.forEach((l: any) => tags.add(l.entity.description));
    shotLabels.forEach((l: any) => tags.add(l.entity.description));

    return {
        tags: Array.from(tags),
        raw: result
    };

  } catch (error) {
    console.error("Video Intelligence Error:", error);
    throw error;
  }
};
