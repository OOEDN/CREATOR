
/**
 * Service to interact with Google Cloud Vision API
 */
import { getGcsReferenceFromUrl } from './googleCloudStorage';

const VISION_API_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const analyzeImageWithVision = async (
  imageUrl: string, 
  accessToken: string,
  projectId?: string
): Promise<{ tags: string[], raw: any }> => {
  try {
    let imageSource: any = {};

    // 1. Try to get GCS URI first (Robust way for large files)
    const gcsUri = getGcsReferenceFromUrl(imageUrl);
    
    if (gcsUri) {
        console.log(`Using GCS URI for Vision: ${gcsUri}`);
        imageSource = {
            source: { gcsImageUri: gcsUri }
        };
    } else {
        // 2. Fallback to Base64 (Only if not in cloud or local blob)
        // Warning: This will fail for >10MB images
        const imageResponse = await fetch(imageUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!imageResponse.ok) throw new Error(`Failed to fetch image data: ${imageResponse.status}`);
        const blob = await imageResponse.blob();
        const base64Image = await blobToBase64(blob);
        imageSource = {
            content: base64Image
        };
    }

    // 3. Prepare Vision API Request
    const requestBody = {
      requests: [
        {
          image: imageSource,
          features: [
            { type: "LABEL_DETECTION", maxResults: 15 },
            { type: "OBJECT_LOCALIZATION", maxResults: 5 },
            { type: "SAFE_SEARCH_DETECTION" },
            { type: "TEXT_DETECTION" }, // OCR for products
            { type: "LOGO_DETECTION" }  // Brand detection
          ]
        }
      ]
    };

    // 4. Call Vision API
    const response = await fetch(VISION_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(projectId ? { 'X-Goog-User-Project': projectId } : {})
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Vision API Error:", errorData);
      throw new Error(errorData.error?.message || 'Vision API request failed');
    }

    const data = await response.json();
    const result = data.responses?.[0];

    if (!result) {
      return { tags: [], raw: null };
    }

    // 5. Process Labels
    const labels = result.labelAnnotations?.map((label: any) => label.description) || [];
    const objects = result.localizedObjectAnnotations?.map((obj: any) => obj.name) || [];
    const logos = result.logoAnnotations?.map((l: any) => l.description) || [];
    
    const allTags = Array.from(new Set([...labels, ...objects, ...logos])) as string[];

    return {
      tags: allTags,
      raw: result
    };

  } catch (error) {
    console.error("Cloud Vision Service Error:", error);
    throw error;
  }
};
