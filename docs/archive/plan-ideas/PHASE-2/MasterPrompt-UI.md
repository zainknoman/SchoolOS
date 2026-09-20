> **ARCHIVED 2026-09-20** — Pre-build planning/audit material (2026-09-08). Historical; see docs/README.md. Do not treat as current documentation.

# SchoolOS — Production-Grade UI/UX Upgrade
You are working directly inside the GitHub repository:
https://github.com/zainknoman/SchoolOS
The application is already functional. Your task is to upgrade the **visual design, CSS, UX, layout, and frontend component quality** of the SchoolOS application to a professional, production-grade school management platform.
## PRIMARY OBJECTIVE
Transform the current simple-looking UI into a polished, modern, production-quality school management application.
The target design should combine:
* Modern SaaS dashboard quality
* Professional education-platform visual language
* Enterprise-grade data management
* Excellent usability for school administrators and teachers
* Friendly, simple UX for parent-facing experiences
* Responsive desktop/tablet/mobile behavior
Use the following products only as DESIGN INSPIRATION:
* Alma — modern school administration/dashboard patterns
* Veracross — enterprise school-management/data patterns
* ClassDojo — friendly parent/education UX patterns
DO NOT copy their branding, assets, source code, layouts, or proprietary visual identity.
Create a distinct **SchoolOS design language**.
---
# CRITICAL SAFETY RULES
This is an existing working application.
## DO NOT:
* Rewrite the backend
* Change database schema
* Change Prisma models
* Change API contracts
* Change authentication logic
* Change authorization/business rules
* Change existing routes unless absolutely required for UI
* Remove working features
* Remove existing functionality
* Replace working API calls with mock data
* Replace real data with hardcoded demo data
* Rewrite the application architecture unnecessarily
* Migrate the project to Tailwind CSS
* Introduce Tailwind just for styling
* Replace Vue with another framework
* Replace the existing frontend architecture unnecessarily
* Replace working state management
* Break existing responsive behavior
* Delete existing tests
* Disable tests to make the build pass
* Hide errors instead of fixing them
## IMPORTANT
Before modifying anything, inspect the existing repository and understand:
* Frontend structure
* Vue version
* Build system
* Existing CSS architecture
* Existing component architecture
* Existing UI libraries
* Existing routing
* Existing layouts
* Existing design tokens
* Existing reusable components
* Existing page structure
* Existing responsive behavior
* Existing tests
Preserve the existing technology choices wherever possible.
---
# PHASE 1 — COMPLETE FRONTEND UI AUDIT
Before making significant changes, inspect the entire frontend.
Identify:
1. Main frontend application directory
2. package.json
3. Vue entry point
4. Router
5. Layout components
6. Sidebar/navigation
7. Header/topbar
8. Dashboard
9. Student pages
10. Teacher pages
11. Parent-related pages
12. Admissions
13. Attendance
14. Fees/accounts
15. Timetable
16. Diary/homework
17. Reports
18. Settings
19. Tables
20. Forms
21. Modals/dialogues
22. Alerts/toasts
23. Loading states
24. Empty states
25. Error states
26. Existing CSS files
27. Existing component styles
28. Any UI component library already installed
29. Any duplicate styling patterns
30. Any hardcoded colors, spacing, border-radius, shadows, etc.
Search the codebase rather than assuming file names.
Create an internal understanding of the current UI before redesigning it.
Do not stop after inspecting a few files.
---
# PHASE 2 — ESTABLISH SCHOOLPORTAL DESIGN SYSTEM
Create a consistent visual system rather than styling every page independently.
Prefer CSS variables/design tokens over scattered hardcoded values.
If appropriate for the existing project, organize styles around something similar to:
src/styles/
tokens.css
typography.css
layout.css
components.css
utilities.css
Adapt the location to the existing frontend architecture if necessary.
Do not create duplicate styling systems.
---
# DESIGN DIRECTION
Use this design philosophy:
## Modern SaaS foundation
* Clean interface
* Excellent whitespace
* Strong visual hierarchy
* Professional typography
* Subtle borders
* Subtle shadows
* Carefully controlled border radius
* Light neutral page backgrounds
* White content surfaces
* Strong but restrained primary color
* Clear status colors
* Attractive data tables
* Modern navigation
* Modern forms
* Consistent spacing
## Education visual language
Use selectively:
* Student avatars
* Academic icons
* Attendance indicators
* Friendly empty states
* Visual timetable presentation
* Homework/activity cards
* Parent-friendly information cards
* Appropriate illustrations only where useful
Avoid making the entire application childish or overly colorful.
## Enterprise data handling
For:
* Admissions
* Students
* Teachers
* Fees
* Accounts
* Reports
* Administration
Prioritize:
* Search
* Filtering
* Sorting
* Pagination
* Status indicators
* Clear tables
* Bulk actions
* Data hierarchy
* Forms
* Validation
* Consistent actions
---
# COLOR SYSTEM
Do not randomly assign colors to individual pages.
Create a coherent SchoolOS palette.
Use:
* Primary brand color
* Primary hover/active color
* Background
* Surface
* Surface elevated
* Border
* Text primary
* Text secondary
* Text muted
* Success
* Warning
* Error
* Information
Status colors must have consistent meaning throughout the application.
Examples:
Present = success
Absent = error
Late = warning
Leave = information
Pending = warning
Approved = success
Rejected = error
Inactive = muted
Do not overuse colors.
---
# TYPOGRAPHY
Create a consistent typography hierarchy:
* Page title
* Section title
* Card title
* Body
* Secondary text
* Labels
* Table text
* Helper text
* Status text
Use the project's existing font setup if appropriate.
If a font needs to be introduced, choose a professional UI font suitable for:
* English
* Urdu
* Arabic/RTL
Ensure the design remains readable when RTL content is displayed.
---
# SPACING SYSTEM
Create consistent spacing tokens.
Avoid arbitrary values such as:
* 13px in one component
* 17px in another
* 21px somewhere else
Use a predictable spacing scale.
---
# BORDER RADIUS
Create consistent radius levels.
For example:
* Small controls
* Inputs
* Cards
* Modals
* Large panels
Do not make everything extremely rounded.
The application should feel professional, not like a children's app.
---
# SHADOWS
Use subtle elevation.
Avoid:
* Heavy shadows
* Glow effects
* Excessive gradients
* Excessive glassmorphism
The visual style should be clean and premium.
---
# PHASE 3 — REDESIGN APPLICATION SHELL
The application shell is one of the highest-priority areas.
Improve:
## Sidebar
Create a modern professional sidebar with:
* SchoolOS branding
* Clear navigation hierarchy
* Icons
* Active state
* Hover state
* Section grouping
* Optional collapsible behavior if compatible with existing architecture
* User/profile area
* Logout/action area
Navigation should be easy to scan.
Do not create unnecessarily deep navigation.
## Header
Improve:
* Page context
* Breadcrumbs where useful
* Search where useful
* Notifications
* User profile
* Campus/school context if already supported
* Responsive behavior
Avoid clutter.
---
# PHASE 4 — REUSABLE COMPONENT SYSTEM
Before redesigning every page independently, identify reusable components.
Where the existing architecture allows it, create/reuse components similar to:
* Button
* IconButton
* Input
* Select
* MultiSelect
* SearchInput
* DatePicker
* Card
* StatCard
* Badge
* Avatar
* Table
* Pagination
* Tabs
* Dropdown
* Modal
* Drawer
* Toast
* Alert
* Tooltip
* Skeleton
* EmptyState
* ErrorState
* PageHeader
* SectionHeader
* FilterBar
* DataToolbar
* FormSection
* ConfirmDialog
Use the project's existing component conventions where possible.
Do not create a new component for every tiny element.
The goal is consistency and maintainability.
---
# BUTTON DESIGN
Create consistent button variants:
* Primary
* Secondary
* Outline
* Ghost
* Danger
* Success where appropriate
Support:
* Hover
* Focus
* Disabled
* Loading
Buttons should have consistent height, padding, typography, radius and icon alignment.
---
# FORM DESIGN
Upgrade all forms visually.
Forms should have:
* Clear labels
* Required indicators
* Helpful placeholders
* Validation messages
* Consistent spacing
* Proper input heights
* Focus states
* Disabled states
* Error states
* Accessible labels
Large forms should be divided into logical sections.
For example:
Student:
Personal Information
Contact Information
Academic Information
Parent/Guardian Information
Previous School
Medical/Additional Information
Documents
Do not change backend fields as part of this task.
Only improve presentation of existing fields.
---
# TABLE DESIGN
Tables are extremely important for SchoolOS.
Create a professional enterprise table experience.
Improve:
* Header
* Row spacing
* Typography
* Borders
* Hover state
* Selected state
* Status badges
* Avatars
* Actions
* Pagination
* Search
* Filters
* Empty state
* Loading state
Where appropriate:
* Sticky table header
* Horizontal scrolling on small screens
* Responsive column handling
* Action menu instead of excessive visible buttons
Do not make tables unnecessarily huge.
---
# DASHBOARD REDESIGN
The dashboard should not consist only of basic statistic cards.
Create a professional dashboard hierarchy.
Recommended structure:
1. Welcome/context area
2. Key KPI cards
3. Attendance overview
4. Student/teacher statistics
5. Recent activity
6. Upcoming events/classes
7. Pending actions
8. Important alerts
9. Quick actions
Only display information that already exists in the application/backend.
Do not invent fake metrics.
If a chart library already exists, improve its presentation.
If charts are not present, do not introduce a large charting dependency unless genuinely useful.
---
# STUDENTS
Redesign student management screens.
Student list should visually support:
* Search
* Filters
* Class
* Section
* Campus
* Status
* Student avatar/initial
* Parent information where available
* Actions
Student profile should look like a professional student information system.
Use sections/cards rather than presenting every field as a flat wall of text.
---
# TEACHERS
Create a professional teacher-management experience.
Include visual hierarchy for:
* Teacher identity
* Contact information
* Employment information
* Assigned classes
* Subjects
* Attendance where already supported
* Status
* Actions
Do not invent fields.
---
# ADMISSIONS
Admissions should feel like a professional workflow.
Improve:
* Admission list
* Search
* Filters
* Status
* Applicant information
* Application detail
* Form sections
* Documents where supported
* Admission actions
Use clear workflow/status presentation.
Example visual statuses:
Draft
Submitted
Under Review
Approved
Rejected
Only use statuses that actually exist in the application.
---
# ATTENDANCE
Attendance should be visually clear and fast to use.
Use clear visual distinction between:
* Present
* Absent
* Late
* Leave
* Holiday
Avoid relying only on color.
Use:
* Text
* Icons
* Badges
* Accessible contrast
Make attendance entry efficient for teachers.
---
# FEES / ACCOUNTS
Use an enterprise financial UI style.
Prioritize:
* Clear amounts
* Status
* Due dates
* Paid/unpaid state
* Voucher information
* Filters
* Search
* Tables
Avoid decorative UI that reduces readability.
---
# TIMETABLE
Create a visually strong timetable.
Use:
* Day columns
* Period rows
* Subject
* Teacher
* Time
* Classroom where supported
Make it easy to scan.
Ensure mobile behavior works appropriately.
---
# DIARY / HOMEWORK / ACTIVITIES
Use an education-friendly card/timeline style.
Make:
* Date
* Class
* Subject
* Homework/activity
* Attachments where supported
* Status
easy to understand.
Do not make it visually overloaded.
---
# REPORTS
Reports should use an enterprise layout.
Improve:
* Filters
* Date ranges
* Export actions
* Summary cards
* Tables
* Print-friendly presentation
Do not change report logic.
---
# SETTINGS
Create a clean settings experience with:
* Logical sections
* Tabs or grouped panels where appropriate
* Consistent forms
* Clear save/cancel actions
* Destructive actions separated visually
---
# RESPONSIVE DESIGN
The application must work properly across:
* Desktop
* Laptop
* Tablet
* Mobile
Do not simply shrink desktop layouts.
For smaller screens:
* Sidebar should adapt
* Tables should scroll or transform appropriately
* Cards should stack
* Forms should become single-column where appropriate
* Actions should remain accessible
* Modals should fit the viewport
* Navigation should remain usable
Do not introduce horizontal page overflow.
---
# ACCESSIBILITY
Improve accessibility while redesigning.
Ensure:
* Adequate color contrast
* Visible keyboard focus
* Semantic buttons/links
* Labels for inputs
* Accessible modal behavior
* Accessible status information
* Icons are not the only indication of meaning
* Touch targets are large enough
* Disabled states are obvious
Do not sacrifice accessibility for visual appearance.
---
# RTL / URDU
SchoolOS may contain Urdu/Arabic content.
Do not break RTL behavior.
Verify:
* Text alignment
* Direction
* Form layouts
* Icons
* Tables
* Navigation
* Padding/margins
* Modal positioning
* Dropdowns
Avoid CSS that assumes left-to-right positioning when logical CSS properties can be used.
Prefer logical properties such as:
margin-inline
padding-inline
inset-inline
border-inline
where appropriate.
---
# ICONS
Use one consistent icon system.
Do not mix unrelated icon styles.
If the project already has an icon library, use it.
If not, select a lightweight, professional icon library compatible with the existing Vue application rather than manually creating dozens of SVGs.
Icons should support the UI, not dominate it.
---
# MICRO-INTERACTIONS
Add subtle interactions where useful:
* Hover states
* Focus states
* Button loading
* Smooth dropdown opening
* Modal transitions
* Card hover where appropriate
* Skeleton loading
Do NOT add excessive animations.
Avoid:
* Large page animations
* Distracting bouncing
* Excessive gradients
* Constant motion
The application is an ERP/SIS, not a marketing website.
---
# EMPTY / LOADING / ERROR STATES
Every major data-driven screen should have polished:
* Loading state
* Empty state
* Error state
Do not leave blank white areas when data is loading.
Use skeletons where appropriate.
Empty states should explain what the user can do next.
---
# DESIGN QUALITY STANDARD
The finished application should feel closer to a modern commercial SaaS/SIS product than a basic CRUD application.
Avoid:
* Default browser-looking inputs
* Plain HTML tables
* Random colors
* Excessive borders
* Huge headings
* Inconsistent cards
* Inconsistent button styles
* Inconsistent spacing
* Excessive shadows
* Excessive rounded corners
* Cluttered dashboards
* Poor mobile layouts
* Text-heavy walls of information
---
# IMPLEMENTATION STRATEGY
Do NOT attempt an uncontrolled rewrite of the entire frontend.
Implement in this order:
## Step 1
Audit existing frontend.
## Step 2
Create the design tokens/foundation.
## Step 3
Upgrade application shell:
* Sidebar
* Header
* Main layout
* Navigation
## Step 4
Upgrade reusable components.
## Step 5
Redesign dashboard.
## Step 6
Redesign:
* Students
* Student profile
* Teachers
## Step 7
Redesign:
* Attendance
* Admissions
## Step 8
Redesign:
* Fees/accounts
* Timetable
* Diary/homework
## Step 9
Redesign:
* Reports
* Settings
* Remaining screens
## Step 10
Responsive/mobile pass.
## Step 11
Accessibility pass.
## Step 12
Visual consistency pass.
---
# IMPORTANT: WORK IN ITERATIONS
After each major area:
1. Inspect changes
2. Run the relevant frontend tests
3. Run lint/type checks if configured
4. Run production build
5. Fix errors
6. Continue
Do not wait until the very end to discover that the build is broken.
---
# TESTING REQUIREMENTS
Before declaring the task complete:
Run the existing frontend test suite.
Run the production build.
Run lint/type checks if they exist.
Verify:
* Login still works
* Navigation still works
* Existing routes still work
* Existing API calls still work
* Forms still submit
* Tables still load data
* Filters still work
* Pagination still works
* Modals still work
* Attendance functionality still works
* Admissions functionality still works
* Fees functionality still works
* Responsive layout works
* RTL does not break
* No console errors introduced by the redesign
Do not modify tests simply to make them pass.
---
# GIT SAFETY
Before starting:
Check:
git status
Understand whether there are existing uncommitted changes.
DO NOT overwrite unrelated user work.
Do not reset the repository.
Do not run destructive commands such as:
git reset --hard
git clean -fd
unless explicitly instructed.
Keep changes focused on the frontend UI/UX.
---
# CODE QUALITY
Keep the implementation maintainable.
Avoid:
* Duplicate CSS
* Giant components
* Excessive inline styles
* !important everywhere
* Hardcoded colors throughout components
* Copy-pasted button/table/card styles
* Dead CSS
* Unused dependencies
* Unused components
Prefer reusable tokens and components.
---
# IMPORTANT: DO NOT CHANGE BUSINESS LOGIC
This task is primarily a UI/UX/CSS modernization.
If you discover a backend or business-logic issue:
DO NOT silently modify it.
Document it separately as:
"Existing functional issue discovered — not modified because it is outside the UI redesign scope."
---
# FINAL ACCEPTANCE CRITERIA
The task is complete only when:
### Visual
* The UI looks significantly more premium than the existing application.
* Pages have clear visual hierarchy.
* Navigation looks professional.
* Cards are consistent.
* Tables look professional.
* Forms look polished.
* Buttons are consistent.
* Status indicators are consistent.
* Dashboard looks production-grade.
* Empty/loading/error states are polished.
### UX
* Navigation is intuitive.
* Common tasks require fewer visual steps.
* Tables are easy to scan.
* Forms are easy to understand.
* Actions are clearly visible.
* Mobile layouts remain usable.
### Technical
* Existing functionality remains intact.
* Existing API integration remains intact.
* Existing routes remain intact.
* Existing tests continue to pass.
* Production build succeeds.
* No unnecessary framework migration occurred.
* No Tailwind migration occurred.
* No database/backend changes occurred.
### Consistency
The same design language must be visible throughout the entire staff web application.
Do not redesign only the dashboard while leaving the rest of the application visually inconsistent.
---
# FINAL REPORT
When finished, provide a concise report containing:
## 1. UI audit
What was wrong with the previous visual system.
## 2. Design system
What tokens/components were introduced.
## 3. Pages redesigned
List every page/screen changed.
## 4. Files changed
List important files/directories changed.
## 5. Dependencies
List any dependencies added and explain why.
## 6. Testing
Report:
* Tests
* Lint/type check
* Build
## 7. Functional verification
Confirm that existing functionality was preserved.
## 8. Remaining recommendations
List any UI improvements that should be handled in a future iteration.
---
# MOST IMPORTANT INSTRUCTION
Do not interpret this task as "make the colors prettier."
Treat it as a **production-grade design-system and UX modernization project**.
Inspect the existing SchoolOS implementation first, preserve the application's functionality, then systematically upgrade the frontend visual system, reusable components, layouts, pages, responsiveness, accessibility, and overall polish.
Start with the audit now.
Do not ask me to describe the existing frontend structure — inspect the repository yourself.