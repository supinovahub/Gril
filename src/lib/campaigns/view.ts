export type CampaignListRow = {
  archived_at: string | null;
  status: string;
};

export function isArchivedCampaign(campaign: CampaignListRow) {
  return campaign.status === "archived" || campaign.archived_at !== null;
}

export function belongsToCampaignView(campaign: CampaignListRow, showingArchived: boolean) {
  return isArchivedCampaign(campaign) === showingArchived;
}
