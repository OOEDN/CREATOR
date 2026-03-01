
// Service to upload files to Google Workspace (Drive)
// Requires Scope: https://www.googleapis.com/auth/drive or https://www.googleapis.com/auth/drive.file

const getHeaders = (accessToken: string, projectId?: string, contentType?: string) => {
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`
    };
    if (contentType) {
        headers['Content-Type'] = contentType;
    }
    // CRITICAL FIX: The Drive API often rejects generic tokens without a quota project.
    // This header attributes the API usage to the user's specific project.
    if (projectId) {
        headers['X-Goog-User-Project'] = projectId;
    }
    return headers;
};

// HELPER: Retry fetch logic. 
// If it fails with 400/403/404 (Project ID invalid or denied), retry WITHOUT the project ID header.
const fetchWithRetry = async (url: string, options: RequestInit, projectId?: string): Promise<Response> => {
    try {
        const res = await fetch(url, options);

        // AGGRESSIVE RETRY: If any client error occurs related to project/permissions, try stripped headers
        if (!res.ok && (res.status === 400 || res.status === 403 || res.status === 404) && projectId) {
            console.warn(`Request failed with Project ID (${res.status}). Retrying without X-Goog-User-Project header...`);

            // Clone options to remove the specific header
            const newOptions = { ...options };
            const newHeaders = new Headers(options.headers);
            newHeaders.delete('X-Goog-User-Project');
            newOptions.headers = newHeaders;

            return await fetch(url, newOptions);
        }
        return res;
    } catch (e) {
        throw e;
    }
};

export const uploadToGoogleDrive = async (
    file: File | Blob,
    folderId: string,
    accessToken: string,
    fileName?: string,
    projectId?: string
): Promise<void> => {
    try {
        const name = fileName || (file instanceof File ? file.name : `upload-${Date.now()}`);
        console.log(`Starting Drive Upload: ${name} to folder ${folderId} (Project: ${projectId || 'None'})`);

        const contentType = file.type || 'application/octet-stream';
        const isSmallFile = file.size < 4 * 1024 * 1024; // 4MB

        if (isSmallFile) {
            const metadata = {
                name: name,
                parents: [folderId],
                mimeType: contentType
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            const options = {
                method: 'POST',
                headers: getHeaders(accessToken, projectId),
                body: form
            };

            const response = await fetchWithRetry('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', options, projectId);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Drive Multipart Upload Failed (${response.status}): ${errText}`);
            }
        } else {
            // LARGE FILE STRATEGY (Resumable)
            const metadata = {
                name: name,
                parents: [folderId],
                mimeType: contentType
            };

            const initOptions = {
                method: 'POST',
                headers: getHeaders(accessToken, projectId, 'application/json'),
                body: JSON.stringify(metadata)
            };

            const initResponse = await fetchWithRetry('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', initOptions, projectId);

            if (!initResponse.ok) {
                const errText = await initResponse.text();
                throw new Error(`Drive Init Failed (${initResponse.status}): ${errText}`);
            }

            const uploadUrl = initResponse.headers.get('Location');
            if (!uploadUrl) {
                throw new Error("Drive API did not return an upload location.");
            }

            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': contentType }, // Put requires clean headers often
                body: file
            });

            if (!uploadResponse.ok) {
                const errText = await uploadResponse.text();
                throw new Error(`Drive Resumable Upload Failed (${uploadResponse.status}): ${errText}`);
            }
        }

        console.log("Drive Upload Success!");

    } catch (error) {
        console.error("Google Drive Upload Error:", error);
        throw error;
    }
};

// Create a new Folder and return the ID
export const createDriveFolder = async (
    folderName: string,
    accessToken: string,
    projectId?: string
): Promise<string> => {
    try {
        const metadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        };

        const options = {
            method: 'POST',
            headers: getHeaders(accessToken, projectId, 'application/json'),
            body: JSON.stringify(metadata)
        };

        const response = await fetchWithRetry('https://www.googleapis.com/drive/v3/files', options, projectId);

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Create Folder Failed (${response.status}): ${err}`);
        }

        const data = await response.json();
        return data.id;
    } catch (error) {
        console.error("Error creating folder:", error);
        throw error;
    }
};

// Find a folder by name to avoid duplicates
export const findDriveFolderByName = async (
    folderName: string,
    accessToken: string,
    projectId?: string
): Promise<string | null> => {
    // Escape single quotes in folder name
    const safeName = folderName.replace(/'/g, "\\'");
    const query = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

    try {
        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: getHeaders(accessToken, projectId)
        }, projectId);

        if (!response.ok) return null;

        const data = await response.json();
        if (data.files && data.files.length > 0) {
            return data.files[0].id;
        }
        return null;
    } catch (e) {
        console.warn("Drive Search Error", e);
        return null;
    }
};

// Ensure the specific OOEDN Master folder exists
export const ensureOOEDNMasterFolder = async (
    accessToken: string,
    projectId?: string
): Promise<string> => {
    const FOLDER_NAME = "OOEDN Master Content Assets";
    try {
        const existingId = await findDriveFolderByName(FOLDER_NAME, accessToken, projectId);
        if (existingId) return existingId;

        return await createDriveFolder(FOLDER_NAME, accessToken, projectId);
    } catch (e) {
        console.error("Error ensuring master folder:", e);
        throw new Error("Failed to initialize Master Drive Folder");
    }
};

/**
 * Sync a single content item from GCS to Google Drive.
 * Fetches the file via its GCS URL with the auth token, then re-uploads to Drive.
 */
export const syncContentToDrive = async (
    fileUrl: string,
    fileName: string,
    folderId: string,
    accessToken: string,
    projectId?: string
): Promise<boolean> => {
    try {
        // Fetch from GCS
        const response = await fetch(fileUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            console.warn(`[DriveSync] Failed to fetch from GCS: ${response.status}`);
            return false;
        }
        const blob = await response.blob();

        // Upload to Drive
        await uploadToGoogleDrive(blob, folderId, accessToken, fileName, projectId);
        return true;
    } catch (e) {
        console.warn(`[DriveSync] Failed to sync ${fileName}:`, e);
        return false;
    }
};

/**
 * Bulk sync: uploads all un-backed-up content items to Drive.
 * Calls onProgress for each item processed.
 */
export const syncAllContentToDrive = async (
    items: { id: string; fileUrl: string; title: string; driveBackedUp?: boolean }[],
    accessToken: string,
    projectId?: string,
    onProgress?: (synced: number, total: number, currentItem: string) => void,
    onItemComplete?: (id: string) => void
): Promise<{ synced: number; failed: number; total: number }> => {
    const unsynced = items.filter(i => !i.driveBackedUp && i.fileUrl);
    const total = unsynced.length;
    let synced = 0;
    let failed = 0;

    if (total === 0) return { synced: 0, failed: 0, total: 0 };

    // Get or create master folder
    let folderId: string;
    try {
        folderId = await ensureOOEDNMasterFolder(accessToken, projectId);
    } catch (e) {
        console.error('[DriveSync] Cannot create master folder:', e);
        return { synced: 0, failed: total, total };
    }

    for (const item of unsynced) {
        onProgress?.(synced + failed, total, item.title);

        const success = await syncContentToDrive(
            item.fileUrl, item.title, folderId, accessToken, projectId
        );

        if (success) {
            synced++;
            onItemComplete?.(item.id);
        } else {
            failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
    }

    return { synced, failed, total };
};
