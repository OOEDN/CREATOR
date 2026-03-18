
/**
 * Service to manage Google Cloud Project IAM permissions and Bucket settings.
 */

interface IAMBinding {
  role: string;
  members: string[];
}

interface IAMPolicy {
  version: number;
  bindings: IAMBinding[];
  etag: string;
}

export const getProjectIAMPolicy = async (projectId: string, token: string): Promise<IAMPolicy> => {
  const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errData = await response.json();
    const message = errData.error?.message || 'IAM Fetch Failed';
    // Check for specific API disabled error
    if (message.includes('CLOUD RESOURCE MANAGER API HAS NOT BEEN USED')) {
        const error = new Error(message) as any;
        error.code = 'API_DISABLED';
        error.url = `https://console.developers.google.com/apis/api/cloudresourcemanager.googleapis.com/overview?project=${projectId}`;
        throw error;
    }
    throw new Error(message);
  }

  return await response.json();
};

export const setProjectIAMPolicy = async (projectId: string, token: string, policy: IAMPolicy): Promise<IAMPolicy> => {
  const url = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
        policy,
        updateMask: "bindings,etag"
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || 'IAM Update Failed');
  }

  return await response.json();
};

export const grantTeamAccess = async (projectId: string, token: string, userEmail: string): Promise<boolean> => {
  try {
    const policy = await getProjectIAMPolicy(projectId, token);
    const userPrincipal = `user:${userEmail.trim()}`;
    
    const rolesToGrant = [
      'roles/storage.objectAdmin',
      'roles/serviceusage.serviceUsageConsumer'
    ];

    let changed = false;
    rolesToGrant.forEach(role => {
      let binding = policy.bindings.find(b => b.role === role);
      if (!binding) {
        binding = { role, members: [] };
        policy.bindings.push(binding);
      }
      
      if (!binding.members.includes(userPrincipal)) {
        binding.members.push(userPrincipal);
        changed = true;
      }
    });

    if (changed) {
      await setProjectIAMPolicy(projectId, token, policy);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("IAM Grant Error:", error);
    throw error;
  }
};

export const fixBucketCORS = async (bucketName: string, token: string): Promise<void> => {
    const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}?fields=cors`;
    
    const corsConfig = [
        {
            "origin": ["*"],
            "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
            "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "X-Requested-With", "X-Goog-Resumable", "Location", "X-Goog-User-Project"],
            "maxAgeSeconds": 3600
        }
    ];

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cors: corsConfig })
    });

    if (!response.ok) {
        const errData = await response.json();
        const message = errData.error?.message || 'CORS Fix Failed';
        if (response.status === 404) {
            const error = new Error(`Bucket "${bucketName}" not found. Check Settings.`) as any;
            error.code = 'BUCKET_NOT_FOUND';
            throw error;
        }
        throw new Error(message);
    }
};

export const revokeTeamAccess = async (projectId: string, token: string, userEmail: string): Promise<boolean> => {
  try {
    const policy = await getProjectIAMPolicy(projectId, token);
    const userPrincipal = `user:${userEmail.trim()}`;
    
    let changed = false;
    policy.bindings = policy.bindings.map(binding => {
      if (binding.members.includes(userPrincipal)) {
        binding.members = binding.members.filter(m => m !== userPrincipal);
        changed = true;
      }
      return binding;
    });

    if (changed) {
      await setProjectIAMPolicy(projectId, token, policy);
      return true;
    }
    return false;
  } catch (error) {
    console.error("IAM Revoke Error:", error);
    throw error;
  }
};
