import { type ExportResource } from "./export-resources";

export { exportResources, type ExportResource } from "./export-resources";

/**
 * Server-only CampusGroups Data Export API adapter. The API follows an async
 * pattern: POST a date-bounded request, then GET with queryId until the export
 * is ready; follow NextToken until every page is read.
 */
type ExportWindow = { updatedStart: string; updatedEnd: string };
type QueryResponse = { queryId?: string; queryID?: string };
type ExportPage<T> = { Results?: T[]; results?: T[]; NextToken?: string; nextToken?: string };

const timeout = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class CampusGroupsExportClient {
  constructor(
    private readonly baseUrl: string,
    private readonly schoolCode: string,
    private readonly apiSecret: string,
  ) {}

  static fromEnvironment() {
    const schoolCode = process.env.CG_SCHOOL_CODE;
    const apiSecret = process.env.CG_API_SECRET;
    if (!schoolCode || !apiSecret) throw new Error("CampusGroups credentials are missing.");
    const baseUrl = process.env.CG_API_BASE_URL ?? `https://${schoolCode}.service.campusgroups.com/data/v1`;
    return new CampusGroupsExportClient(baseUrl, schoolCode, apiSecret);
  }

  private headers() {
    return {
      Accept: "application/json",
      "X-CG-API-Secret": this.apiSecret,
      "X-CG-School": this.schoolCode,
    };
  }

  private url(resource: ExportResource, params: Record<string, string>) {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/${resource}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  }

  async exportAll<T = unknown>(resource: ExportResource, window: ExportWindow): Promise<T[]> {
    // The OpenAPI document defines an async, date-bounded request before results
    // can be retrieved. `size=999` is the documented maximum page size.
    const request = await fetch(this.url(resource, { ...window, size: "999" }), {
      method: "POST",
      headers: this.headers(),
      cache: "no-store",
    });
    if (!request.ok) throw new Error(`CampusGroups ${resource} request failed (${request.status}).`);
    const query = (await request.json()) as QueryResponse;
    const queryId = query.queryId ?? query.queryID;
    if (!queryId) throw new Error("CampusGroups did not return a query ID.");

    const all: T[] = [];
    let token: string | undefined;
    let readinessPolls = 0;
    // 999 is the API's maximum page size. The deliberately high cap prevents a
    // malformed nextToken from looping forever without truncating a legitimate
    // institution-wide export at 99,900 rows.
    for (let page = 0; page < 10_000; page += 1) {
      const params: Record<string, string> = { queryId, size: "999" };
      if (token) params.token = token;
      const response = await fetch(this.url(resource, params), { headers: this.headers(), cache: "no-store" });
      if (response.status === 202 || response.status === 201) {
        readinessPolls += 1;
        if (readinessPolls > 50) throw new Error("CampusGroups export did not become ready within the polling limit.");
        await timeout(600);
        page -= 1;
        continue;
      }
      if (!response.ok) throw new Error(`CampusGroups ${resource} retrieval failed (${response.status}).`);
      const payload = (await response.json()) as ExportPage<T>;
      readinessPolls = 0;
      all.push(...(payload.Results ?? payload.results ?? []));
      token = payload.NextToken ?? payload.nextToken;
      if (!token) return all;
    }
    throw new Error(`CampusGroups ${resource} export exceeded the 10,000-page safety limit.`);
  }
}
