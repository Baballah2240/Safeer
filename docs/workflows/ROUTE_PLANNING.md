# Cities, destinations and route planning

Section 04 / 0.5.0. This plans company routes; it does not publish passenger trips or collect payments.

1. Sign in as Super Admin and open Cities & destinations. Add English/Arabic names, a unique code and two-letter country code. City edits require your current password and the current version. Deactivate obsolete cities instead of deleting them.
2. Open Companies and select/create your company. Follow the company approval workflow. Add a branch and stations under Branches & stations. Edit each station to assign its city; existing unassigned stations remain usable as company resources but cannot be linked to route stops until assigned.
3. Open Routes & stops. Existing company roles need explicit company-wide route permissions assigned by Super Admin. New company-administrator role copies include them. Branch/station-scoped permissions do not grant company-wide catalog access.
4. Create a route with bilingual names and company-unique code. Add 2-30 stops, select cities and optionally a station in that city. Move stops up/down using the accessible controls. First/last cities must differ. Distinct stations within one city are allowed; identical city/station pairs cannot repeat.
5. Save with your current password. The entire change commits or rolls back together. If another editor saved first, refresh and review before retrying. View stops to inspect travel order.
6. Retire a route by clearing Active when it is no longer used. Active routes prevent deactivating their cities/stations/branches. Even an inactive route retains its station-city reference: detach that station from all routes before changing its city.

Company audit records route creation/edits; platform audit records city changes. Support users need an explicit, read-only company route grant with a reason and expiry. They cannot edit routes. No route or city hard deletion is available.

Future trips must snapshot their route, stops and display data when Section 06 implements scheduling/publication. Do not reinterpret current edit counters as immutable trip history. Stop before Section 05 until the owner approves it.
