
import { Creator, Campaign, ContentItem } from "../types";

const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote or newline to prevent CSV breakage
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportAllDataToCSV = (
    creators: Creator[], 
    campaigns: Campaign[], 
    content: ContentItem[]
) => {
    // 1. Creators Master List
    const creatorHeaders = [
        'ID', 'Name', 'Handle', 'Platform', 'Email', 'Rate', 'Status', 
        'Payment Methods', 'Payment Status', 'Notes', 'Campaign', 
        'Shipment Status', 'Tracking Number', 'Carrier', 'Date Added'
    ];
    
    // FIXED: Format paymentOptions array into a single string for CSV column
    const creatorRows = creators.map(c => [
        c.id, c.name, c.handle, c.platform, c.email, c.rate, c.status, 
        c.paymentOptions?.map(o => `${o.method}: ${o.details}`).join(' | ') || '',
        c.paymentStatus, c.notes, c.campaign, 
        c.shipmentStatus, c.trackingNumber, c.carrier, c.dateAdded
    ]);
    
    downloadCSV(`ooedn_creators_master_${new Date().toISOString().split('T')[0]}.csv`, creatorHeaders, creatorRows);

    // 2. Campaigns List (Delayed slightly to ensure browser doesn't block multiple downloads)
    if (campaigns.length > 0) {
        setTimeout(() => {
            const campHeaders = ['ID', 'Title', 'Status', 'Description', 'Assigned Creator Count', 'Last Updated'];
            const campRows = campaigns.map(c => [
                c.id, c.title, c.status, c.description, c.assignedCreatorIds.length, c.lastUpdated
            ]);
            downloadCSV(`ooedn_campaigns.csv`, campHeaders, campRows);
        }, 300);
    }

    // 3. Content Library Log
    if (content.length > 0) {
        setTimeout(() => {
            const contentHeaders = [
                'ID', 'Title', 'Type', 'Status', 'Platform', 'Creator Name', 
                'Campaign ID', 'Upload Date', 'Scheduled Date', 'File URL / Source'
            ];
            const contentRows = content.map(c => [
                c.id, c.title, c.type, c.status, c.platform, c.creatorName, 
                c.campaignId, c.uploadDate, c.scheduledDate, 
                c.storageType === 'cloud' ? c.fileUrl : 'Local Browser Storage'
            ]);
            downloadCSV(`ooedn_content_library.csv`, contentHeaders, contentRows);
        }, 600);
    }
};
