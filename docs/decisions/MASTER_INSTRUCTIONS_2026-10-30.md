# PROJECT: SUDAN TRANSPORT
## Master Development Instructions

Act as a senior software architect, full-stack engineer, database architect, UI/UX designer, and quality assurance engineer.

Your responsibility is to build a professional, scalable, secure, and production-ready land passenger transportation platform for Sudan.

Do not treat this as a simple ticket booking application. Build it as a complete multi-company transportation management platform with a central passenger marketplace.

---

# 1. DEVELOPMENT STRATEGY

We have agreed on the overall business model and system architecture.

**IMPORTANT: Develop the system ONE SECTION AT A TIME.**

Do not attempt to implement every feature simultaneously.

Follow this development process:

1. Inspect the existing project and understand its architecture.
2. Establish and document the complete technical foundation.
3. Prepare the database architecture for all planned modules.
4. Establish authentication, permissions, company isolation, shared services, and reusable components.
5. Divide the application into independent development sections.
6. Implement only the current section.
7. Test the section thoroughly.
8. Fix all issues and verify that existing functionality still works.
9. Update the project archive and technical documentation.
10. Only then proceed to the next section.

Do not move to another section while the current section has unfinished critical functionality, broken workflows, or unresolved major bugs.

Never sacrifice code quality or security to finish a section quickly.

---

# 2. INITIAL BUSINESS SCOPE

The first release is exclusively for:

- Passenger transportation.
- Intercity bus reservations.
- Passenger information.
- Seat selection.
- Temporary seat reservations.
- Ticket issuance.
- Station payments.
- Payment receipts.
- Passenger luggage registration and management.
- Boarding and trip completion.

Do not implement parcel shipping, freight transportation, cargo delivery, or unrelated logistics services in the first release.

However, prepare a modular architecture that allows future logistics and freight modules to be added without redesigning the entire system.

Do not build unused functionality simply because it might be needed in the future.

Build clean extension points and well-defined interfaces instead.

---

# 3. APPROVED BUSINESS MODEL

The application will operate as:

**One central marketplace + individual company booking pages + independent company management systems.**

### Central marketplace

Passengers can:

- Search trips across multiple approved transportation companies.
- Select departure city and destination.
- Select travel date.
- Compare available trips and prices.
- Compare bus types and departure times.
- See available seats.
- Open individual company pages.
- Select seats and reserve tickets.

### Individual company pages

Every company receives its own public page containing:

- Company name and logo.
- Company information.
- Contact information.
- Available routes.
- Departure schedules.
- Bus categories.
- Ticket prices.
- Available trips.
- Booking options.

Each company must have independent control over its own business operations.

### Passenger booking model

- Guest booking is mandatory as an available option.
- No mandatory passenger account.
- Passenger provides full name and mobile number.
- Passenger selects a trip and seats.
- System temporarily holds selected seats.
- Passenger receives a unique booking reference.
- Passenger pays at the company's authorized ticket office or station.
- An authorized employee records payment.
- System confirms the reservation.
- System generates the official ticket and payment receipt.

No online payment gateway is required for the initial release.

---

# 4. TEMPORARY SEAT RESERVATION ENGINE

This is a critical system component.

Every company must be able to configure its own temporary seat hold duration.

Example:
- Company A: 15 minutes.
- Company B: 30 minutes.

The reservation engine must:

1. Check seat availability on the server.
2. Lock all requested seats safely.
3. Create a reservation and expiry timestamp.
4. Generate a unique booking reference.
5. Display a countdown to the passenger.
6. Automatically release expired seats.
7. Update availability across all interfaces.
8. Prevent duplicate bookings.
9. Support multiple passengers and multiple seats in one booking.
10. Preserve booking history and audit records.

Technical requirements:

- Database transactions.
- Row-level locking.
- Appropriate unique constraints.
- Server-side expiry validation.
- Reliable background expiration jobs.
- Idempotent booking and payment operations.
- Safe concurrency handling.
- No reliance on the browser timer alone.

A seat must never be confirmed based on stale availability.

Support future seat allocation by route segment so the same seat can be sold to different passengers on non-overlapping sections of a journey.

---

# 5. COMPLETE SYSTEM MODULES

Establish the architecture for the following modules:

### A. Platform administration
- Platform dashboard.
- Company registration and approval.
- Company management.
- Platform users and permissions.
- Marketplace management.
- Platform settings.
- Activity and audit logs.
- Global reports.

### B. Passenger marketplace
- Homepage.
- Trip search.
- Search results.
- Company pages.
- Trip details.
- Seat selection.
- Passenger details.
- Booking confirmation.
- Booking retrieval.
- Digital tickets.
- Notifications.

### C. Company management
- Company dashboard.
- Company profile.
- Branches and stations.
- Employee management.
- Roles and permissions.
- Routes and destinations.
- Bus fleet.
- Seat configurations.
- Driver records.
- Trip scheduling.
- Passenger management.
- Reservation management.
- Ticket management.
- Luggage management.
- Financial management.
- Reports and settings.

### D. Station ticketing
- Station dashboard.
- Counter management.
- Reservation search.
- Walk-in booking.
- Passenger verification.
- Payment collection.
- Ticket issuance.
- Receipt printing.
- Cancellation and refund workflows.
- Cash sessions.
- Daily reconciliation.

### E. Driver and boarding
- Driver login.
- Assigned trips.
- Passenger manifest.
- Seat information.
- QR ticket scanning.
- Boarding verification.
- Departure and arrival records.
- Incident reporting.

### F. Passenger luggage management

Luggage must be connected to the passenger and the relevant booking.

Each luggage record should support:

- Luggage identification number.
- Passenger name.
- Passenger mobile number.
- Booking reference.
- Ticket number.
- Bus and trip.
- Luggage category.
- Quantity.
- Weight.
- Description.
- Special handling instructions.
- Luggage tag number.
- Luggage status.

Luggage statuses:

- Registered.
- Tagged.
- Loaded.
- In transit.
- Unloaded.
- Collected.
- Exception reported.

Generate printable luggage tags with unique identification numbers and QR codes.

Allow authorized station employees to register, update, and verify luggage.

Keep luggage tracking separate from passenger ticket status while linking both records.

---

# 6. DATABASE ARCHITECTURE

Use a clean relational database design.

Recommended database: PostgreSQL.

Prepare the architecture for:

- Companies.
- Company settings.
- Branches.
- Stations.
- Users.
- Company users.
- Roles.
- Permissions.
- Passengers.
- Cities.
- Routes.
- Route stops.
- Buses.
- Seat layouts.
- Seats.
- Drivers.
- Trips.
- Trip assignments.
- Trip seat inventory.
- Bookings.
- Booking passengers.
- Seat holds.
- Tickets.
- Payments.
- Payment allocations.
- Receipts.
- Refunds.
- Cash sessions.
- Cash movements.
- Luggage records.
- Luggage tags.
- Boarding records.
- Notifications.
- Documents.
- Audit logs.

Requirements:

- Use proper foreign keys.
- Add appropriate indexes.
- Use unique constraints.
- Define clear relationships.
- Prevent orphaned records.
- Use database migrations.
- Maintain consistent naming conventions.
- Use transactions for critical business operations.

Every company-owned record must have a company identifier.

Implement strict multi-tenant data isolation.

A company must never access another company's private financial, passenger, employee, or operational records.

The platform administrator has authorized global management access.

Never rely exclusively on frontend permissions for security.

---

# 7. FINANCIAL MANAGEMENT

Implement financial functionality carefully.

The initial system must support:

- Ticket payments at company stations.
- Cash payment records.
- Other payment methods when enabled by the company.
- Payment receipts.
- Ticket sales reports.
- Refund records.
- Station cash registers.
- Cash opening and closing.
- Daily reconciliation.
- Employee transaction history.

Important rules:

- Payment confirmation must generate a reliable transaction record.
- A confirmed ticket must have a valid payment record.
- Do not allow unauthorized payment editing.
- Do not delete completed financial transactions.
- Use reversals and adjustments for corrections.
- Keep company financial data separate.
- Record which employee processed each transaction.

Support configurable currencies and Arabic and English currency formatting.

---

# 8. USER ROLES AND ACCESS CONTROL

Prepare a flexible role-based access system.

Initial roles:

1. Platform super administrator.
2. Platform support administrator.
3. Company administrator.
4. Branch manager.
5. Station manager.
6. Ticketing employee.
7. Boarding employee.
8. Driver.

Permissions must be configurable.

Examples:

- Ticketing employee can create reservations, record authorized payments, and issue tickets.
- Ticketing employee cannot modify historical financial records.
- Station manager can manage station employees and reconcile cash.
- Company administrator can manage company operations.
- Driver can only access assigned trips and necessary passenger information.
- Platform support cannot access sensitive company financial records without explicit authorization.

Log important actions.

---

# 9. TECHNICAL ARCHITECTURE

First inspect the existing project and choose technologies compatible with its current state.

If starting from scratch, the preferred architecture is:

- Passenger mobile application: Flutter.
- Public marketplace: Next.js.
- Company dashboard: React / Next.js.
- Station ticketing: Responsive web application / PWA.
- Driver application: Flutter.
- Backend: NestJS.
- Database: PostgreSQL.
- Cache and background jobs: Redis.
- Real-time communication: WebSockets.
- File storage: S3-compatible storage.
- Push notifications: Firebase Cloud Messaging.

Use a modular monolithic backend initially.

Do not create unnecessary microservices.

Keep business logic separated into modules and services so individual modules can evolve independently.

Use versioned APIs.

Document API contracts.

---

# 10. UI/UX DESIGN REQUIREMENTS

The entire application must look modern, professional, clean, and easy to use.

Design principles:

- Simple and intuitive navigation.
- Consistent design system.
- Modern dashboards.
- Clear typography.
- Professional colors.
- Proper spacing.
- Consistent buttons and input fields.
- Responsive layouts.
- Fast interactions.
- Clear loading and error states.
- Accessible contrast.
- Consistent tables and filters.
- Useful empty states.
- Confirmation before sensitive actions.

Support:

- Arabic.
- English.
- RTL for Arabic.
- LTR for English.

Language switching must update the entire interface, including navigation, tables, forms, validation, notifications, and printed tickets.

Avoid duplicated components and inconsistent layouts.

Create reusable components and shared design tokens.

Do not introduce unnecessary animations or decorative elements that reduce usability.

---

# 11. PROJECT ARCHIVE AND DOCUMENTATION — MANDATORY

Create a permanent project documentation and archive directory.

Use:

/docs
    /architecture
    /database
    /workflows
    /modules
    /api
    /security
    /testing
    /decisions
    /archive

Create the following mandatory files:

### PROJECT_MASTER.md

Contains:

- Complete project vision.
- Approved business model.
- System architecture.
- Main modules.
- Development principles.
- Technology decisions.
- Current development phase.

### DEVELOPMENT_ROADMAP.md

Contains:

- All development sections.
- Implementation order.
- Completed sections.
- Current section.
- Pending sections.
- Dependencies.
- Known issues.

### DATABASE_SCHEMA.md

Contains:

- Database entities.
- Relationships.
- Important fields.
- Constraints.
- Indexes.
- Migration history.

### BUSINESS_RULES.md

Contains:

- Reservation rules.
- Seat availability rules.
- Expiry rules.
- Ticket issuance rules.
- Payment rules.
- Cancellation rules.
- Company permissions.
- Luggage rules.

### SYSTEM_ARCHITECTURE.md

Contains:

- Frontend architecture.
- Backend architecture.
- Database architecture.
- API structure.
- Security design.
- Background jobs.
- Real-time services.

### CHANGELOG.md

Record every meaningful change with:

- Date.
- Development section.
- Files added.
- Files modified.
- Files removed.
- Features implemented.
- Bugs fixed.
- Tests performed.
- Remaining issues.

### CURRENT_STATE.md

This is the most important continuation file.

It must always show:

- What has been completed.
- What is currently being developed.
- What works.
- What remains incomplete.
- Known bugs.
- Database migration status.
- Latest test results.
- Next exact development task.

### DECISIONS.md

Record all approved business and technical decisions.

Never silently change an approved decision.

If a change is necessary, document the reason and impact before implementing it.

### SECTION_ARCHIVE_TEMPLATE.md

After finishing each development section, create a detailed archive entry containing:

1. Section name.
2. Objectives.
3. Implemented features.
4. Database changes.
5. Files created or modified.
6. APIs implemented.
7. Permissions implemented.
8. Business rules.
9. Tests performed and results.
10. Bugs discovered and fixed.
11. Remaining limitations.
12. Dependencies.
13. Next section.
14. Instructions for continuing development.

Name each archive entry clearly, for example:

/docs/archive/SECTION_01_FOUNDATION.md
/docs/archive/SECTION_02_AUTHENTICATION.md
/docs/archive/SECTION_03_COMPANY_MANAGEMENT.md

Continue numbering for every section.

Update all relevant documentation whenever the architecture or implementation changes.

Do not write documentation that claims functionality is completed when it has not been tested.

The archive must reflect the actual source code, not assumptions.

---

# 12. CODE QUALITY AND DEVELOPMENT RULES

Follow professional engineering practices.

- Write clean, readable, maintainable code.
- Use clear naming conventions.
- Avoid duplicated code.
- Avoid oversized components.
- Separate business logic from UI.
- Validate all inputs.
- Handle errors consistently.
- Avoid unnecessary dependencies.
- Remove dead code and unused files.
- Avoid temporary hacks.
- Do not leave broken placeholders.
- Do not silently ignore failed operations.
- Avoid hardcoded company-specific values.
- Use configuration for business settings.
- Maintain consistent API response structures.
- Use database migrations instead of manual schema changes.
- Preserve existing working functionality.
- Never overwrite important files without inspecting them.
- Never use mock data as if it were production data.

If existing code is reusable and reliable, improve it instead of rewriting it unnecessarily.

Do not introduce breaking changes without documenting them.

---

# 13. TESTING AND QUALITY ASSURANCE

Every development section must have tests before being marked complete.

Test:

- Normal workflows.
- Invalid inputs.
- Unauthorized access.
- Company data isolation.
- Database constraints.
- Duplicate requests.
- Concurrent requests.
- Network interruptions.
- Error recovery.
- Mobile responsiveness.
- Arabic and English layouts.
- Existing functionality.

Critical reservation tests:

1. Two passengers attempt to reserve the same seat simultaneously.
2. Multiple seats are held in one booking.
3. Hold expires automatically.
4. Expired seat becomes available.
5. Payment is submitted at the exact expiry boundary.
6. Duplicate payment submission.
7. Station and mobile booking happen simultaneously.
8. Bus assignment changes after reservations exist.
9. Passenger books multiple non-overlapping route segments.
10. Booking and ticket records remain consistent after failures.

Do not mark a section complete based on a successful page rendering alone.

Run relevant automated tests, integration tests, and build checks.

Fix all critical and high-priority issues before moving forward.

---

# 14. DEVELOPMENT EXECUTION ORDER

Follow this exact development sequence:

SECTION 01 — Project inspection, architecture, and foundation.

SECTION 02 — Authentication, users, roles, and permissions.

SECTION 03 — Companies, branches, stations, and company isolation.

SECTION 04 — Cities, routes, destinations, and route stops.

SECTION 05 — Bus fleet, seat layouts, and drivers.

SECTION 06 — Trip scheduling and management.

SECTION 07 — Passenger marketplace and individual company pages.

SECTION 08 — Seat inventory and temporary reservation engine.

SECTION 09 — Passenger information and booking management.

SECTION 10 — Station ticketing, payments, tickets, and receipts.

SECTION 11 — Passenger luggage registration, tagging, and tracking.

SECTION 12 — Driver application, QR verification, and boarding.

SECTION 13 — Financial reports and company reconciliation.

SECTION 14 — Platform administration, notifications, and analytics.

SECTION 15 — Security audit, integration testing, optimization, and production preparation.

Do not start the next section automatically before the current section has been tested, archived, and documented.

---

# 15. FIRST TASK — START NOW

For your first task, DO NOT attempt to build the entire application.

Start with SECTION 01 only.

Perform the following:

1. Inspect the complete project directory.
2. Identify the current framework, languages, database, dependencies, and existing features.
3. Review existing code and identify technical problems.
4. Identify reusable components and existing functionality.
5. Check for duplicated files, unused dependencies, and unnecessary code.
6. Design the final project folder structure.
7. Establish the technical architecture.
8. Prepare the database foundation and migration strategy.
9. Define module boundaries and development conventions.
10. Create the complete documentation and archive structure.
11. Create the project roadmap and development tracking files.
12. Test the foundation and ensure the project still builds.

If the project is already partially developed, preserve reliable existing work and document the current state.

Do not create unfinished business features during this first section.

At the end, provide a clear report:

- What you inspected.
- What you changed.
- Architecture decisions.
- Files created or modified.
- Database status.
- Tests performed.
- Remaining issues.
- Exact next development section.

Update CURRENT_STATE.md, DEVELOPMENT_ROADMAP.md, CHANGELOG.md, and the relevant archive entry.

STOP after completing SECTION 01.

Wait for approval before beginning SECTION 02.

---

# FINAL DEVELOPMENT PRINCIPLE

Build this project as if it will become one of Sudan's major transportation platforms.

Prioritize:

1. Reliability.
2. Data integrity.
3. Security.
4. Clean architecture.
5. Simple user experience.
6. Maintainability.
7. Scalability.

Work carefully, think before implementing, test before completing, and archive every finished section.

**One section at a time. No rushed development. No unfinished workflows. No undocumented changes.**