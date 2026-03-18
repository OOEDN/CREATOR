
// Service to upload files directly to Google Cloud Storage with hardened CORS handling

const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 30000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
      });
      clearTimeout(id);
      return response;
  } catch (error) {
      clearTimeout(id);
      throw error;
  }
}

const handleAuthError = (status: number) => {
    if (status === 401 || status === 403) {
        console.error(`OOEDN Sync: Auth session expired or denied (${status}).`);
        window.dispatchEvent(new CustomEvent('ooedn-auth-error', { detail: { status } }));
    }
};

// Helper to extract GS URI from Download URL
export const getGcsReferenceFromUrl = (url: string): string | null => {
    // Expected format: https://storage.googleapis.com/storage/v1/b/[BUCKET]/o/[OBJECT]?alt=media...
    try {
        const regex = /storage\/v1\/b\/([^/]+)\/o\/([^?]+)/;
        const match = url.match(regex);
        if (match) {
            const bucket = decodeURIComponent(match[1]);
            const object = decodeURIComponent(match[2]);
            return `gs://${bucket}/${object}`;
        }
        return null;
    } catch (e) {
        console.error("Error parsing GCS URL", e);
        return null;
    }
};

// Helper to fetch with retry logic for Project ID headers
const fetchGCS = async (url: string, options: RequestInit, projectId?: string): Promise<Response> => {
    const response = await fetch(url, options);
    
    // If we get a 403/400 and we were sending a project ID, try once more WITHOUT it.
    // Some buckets are set up such that team members can access objects but can't "act" on the project.
    if (!response.ok && (response.status === 403 || response.status === 400) && projectId) {
        console.warn(`OOEDN: Retrying GCS request without Project ID header...`);
        const newOptions = { ...options };
        const newHeaders = new Headers(options.headers);
        newHeaders.delete('X-Goog-User-Project');
        newOptions.headers = newHeaders;
        return await fetch(url, newOptions);
    }
    
    return response;
};

export const uploadToGoogleCloud = async (
  file: File | Blob | string, 
  bucketName: string, 
  accessToken: string,
  customName?: string,
  contentType?: string,
  projectId?: string,
  cacheControl: string = 'no-store, no-cache, must-revalidate'
): Promise<string> => {
  let bodyData: Blob | string = file;
  let mimeType = contentType || 'application/octet-stream';
  let rawFileName = customName || `file-${Date.now()}`;
  let fileSize = 0;

  if (file instanceof File) {
      rawFileName = customName || `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      mimeType = file.type;
      fileSize = file.size;
  } else if (file instanceof Blob) {
      fileSize = file.size;
  } else if (typeof file === 'string') {
      const blob = new Blob([file], { type: mimeType });
      bodyData = blob;
      fileSize = blob.size;
  }

  const encodedFileName = encodeURIComponent(rawFileName);
  const isJsonDB = rawFileName.endsWith('.json');
  const isLarge = fileSize > 5 * 1024 * 1024;

  try {
    if (isJsonDB) {
        const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}/o?uploadType=media&name=${encodedFileName}`;
        const response = await fetchGCS(url, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': mimeType,
                'Cache-Control': 'no-cache',
                ...(projectId ? { 'X-Goog-User-Project': projectId } : {})
            },
            body: bodyData
        }, projectId);

        handleAuthError(response.status);
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DB Sync Failed (${response.status}): ${err}`);
        }
    } else if (!isLarge) {
        const boundary = 'ooedn_sync_boundary_' + Date.now();
        const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}/o?uploadType=multipart&name=${encodedFileName}`;
        
        const metadata = { name: rawFileName, contentType: mimeType, cacheControl };
        const metadataPart = `--${boundary}\nContent-Type: application/json; charset=UTF-8\n\n${JSON.stringify(metadata)}\n`;
        const filePartStart = `--${boundary}\nContent-Type: ${mimeType}\n\n`;
        const filePartEnd = `\n--${boundary}--`;

        const multipartBody = new Blob([metadataPart, filePartStart, bodyData, filePartEnd], { 
            type: `multipart/related; boundary=${boundary}` 
        });

        const response = await fetchGCS(url, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
                ...(projectId ? { 'X-Goog-User-Project': projectId } : {})
            },
            body: multipartBody
        }, projectId);

        handleAuthError(response.status);
        if (!response.ok) throw new Error(`Multipart Upload Failed: ${response.status}`);
    } else {
        const initUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}/o?uploadType=resumable&name=${encodedFileName}`;
        const metadata = { name: rawFileName, contentType: mimeType, cacheControl };

        const initResponse = await fetchGCS(initUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': mimeType,
                ...(projectId ? { 'X-Goog-User-Project': projectId } : {})
            },
            body: JSON.stringify(metadata)
        }, projectId);

        handleAuthError(initResponse.status);
        if (!initResponse.ok) throw new Error(`Resumable Init Failed: ${initResponse.status}`);

        const uploadUrl = initResponse.headers.get('Location');
        if (!uploadUrl) throw new Error("CORS: Bucket does not expose 'Location' header.");

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            mode: 'cors',
            body: bodyData,
            headers: { 'Content-Type': mimeType }
        });

        if (!response.ok) throw new Error(`Upload Failed: ${response.status}`);
    }

    return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodedFileName}?alt=media&t=${Date.now()}`;

  } catch (error) {
    console.error("OOEDN GCS ERROR:", error);
    throw error;
  }
};

export const uploadJSONToGoogleCloud = async (jsonData: any, bucketName: string, accessToken: string, filename: string, projectId?: string): Promise<string> => {
    return await uploadToGoogleCloud(JSON.stringify(jsonData), bucketName, accessToken, filename, 'application/json', projectId);
};

export const fetchJSONFromGoogleCloud = async (bucketName: string, accessToken: string, filename: string, projectId?: string): Promise<any | null> => {
    const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(filename)}?alt=media&t=${Date.now()}`;
    try {
        const response = await fetchGCS(url, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                ...(projectId ? { 'X-Goog-User-Project': projectId } : {})
            }
        }, projectId);

        handleAuthError(response.status);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Fetch Failed: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("OOEDN Fetch Error:", error);
        throw error;
    }
};
