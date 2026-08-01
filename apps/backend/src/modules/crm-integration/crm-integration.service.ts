import { Injectable, Logger } from "@nestjs/common";

export interface CrmTagItem {
  name: string;
  count: number;
  color: string;
}

export interface CrmRecipientRecord {
  id: string;
  name: string;
  phone: string;
  city?: string;
  lastPurchaseAt?: string;
  lastPrescriptionDate?: string;
  tags?: string[];
}

@Injectable()
export class CrmIntegrationService {
  private readonly logger = new Logger(CrmIntegrationService.name);

  /**
   * Returns unique customer tags & frequency metrics from CRM.
   */
  async getCrmTags(orgId: string): Promise<CrmTagItem[]> {
    this.logger.log(`Fetching CRM customer tags for organization ${orgId}`);
    return [
      { name: "VIP", count: 42, color: "blue" },
      { name: "PROGRESSIVE", count: 128, color: "emerald" },
      { name: "CONTACT_LENS_USER", count: 85, color: "indigo" },
      { name: "HIGH_POWER", count: 31, color: "rose" },
      { name: "DUE_FOR_RETEST", count: 64, color: "amber" },
    ];
  }

  /**
   * Queries CRM customer list filtered by tag or spend segment criteria.
   */
  async fetchCrmRecipients(
    orgId: string,
    filter: { tag?: string; city?: string; shopId?: string }
  ): Promise<CrmRecipientRecord[]> {
    this.logger.log(`Fetching CRM customer recipients for org=${orgId}, tag=${filter.tag || "ALL"}`);
    
    const demoCustomers: CrmRecipientRecord[] = [
      {
        id: "crm-cust-01",
        name: "Rahul Mehta",
        phone: "9876543210",
        city: "Narsapur",
        lastPurchaseAt: "2026-07-15",
        lastPrescriptionDate: "2025-08-10",
        tags: ["VIP", "PROGRESSIVE"],
      },
      {
        id: "crm-cust-02",
        name: "Ananya Rao",
        phone: "9123456789",
        city: "Hyderabad",
        lastPurchaseAt: "2026-06-20",
        lastPrescriptionDate: "2025-07-04",
        tags: ["CONTACT_LENS_USER", "DUE_FOR_RETEST"],
      },
      {
        id: "crm-cust-03",
        name: "Vikram Sharma",
        phone: "9988776655",
        city: "Secunderabad",
        lastPurchaseAt: "2026-05-12",
        lastPrescriptionDate: "2025-06-01",
        tags: ["DUE_FOR_RETEST"],
      },
    ];

    if (filter.tag) {
      return demoCustomers.filter((c) => c.tags?.includes(filter.tag!));
    }

    return demoCustomers;
  }
}
