# Scheduling and publishing trips

Section 06 / 0.7.0. This plans company trips. Passengers cannot search or book them yet, and nothing is sold.

Before you start, you need an active route, at least one active bus and one active driver. See [route planning](ROUTE_PLANNING.md) and [fleet management](FLEET_MANAGEMENT.md). New-company administrators already have trip access. For an existing company, add the trip permissions to a company-scoped role, along with route, fleet and driver view permissions.

1. Open your company, then Trips, and choose Schedule trips.
2. Choose a route, the first date, the departure time and the fare. Times use the company timezone.
3. Enter the minutes after departure for each stop. The first stop is 0 and each later stop must be higher. The last stop sets the arrival time.
4. To repeat, set Repeat until and tick the weekdays. Up to 31 trips save together, or none do.
5. Choose Assign bus and driver. A bus or driver already on another trip at the same time is refused. Arriving exactly when the next trip departs is allowed.
6. Choose Publish. The trip needs an active bus and driver, a fare above zero and a future departure. A published trip keeps its time and fare; to change them, cancel it and schedule a new one.
7. To replace a bus or driver, choose Change bus or driver and give a reason. View trip shows the full history.
8. To cancel, choose Cancel trip and give a reason. This is final and frees the bus and driver.

A trip keeps the route name, stops, seat-layout revision and driver name it had when created or assigned, so later edits to those records never change it. While a bus or driver is on an upcoming trip, it cannot be deactivated. Company audit records every change. Stop before Section 07 until the owner approves it.
